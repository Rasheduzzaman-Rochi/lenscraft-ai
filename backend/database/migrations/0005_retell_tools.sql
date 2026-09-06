-- Indexed service discovery and an atomic, idempotent CRM command for Retell tools.
BEGIN;

CREATE INDEX services_search_document_idx ON public.services USING gin (
    to_tsvector(
        'simple',
        coalesce(name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(description, '')
    )
);

CREATE FUNCTION public.search_active_services(
    p_company_id uuid,
    p_query text,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    name text,
    category text,
    description text,
    pricing_type text,
    relevance real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT
        service.id,
        service.name,
        service.category,
        service.description,
        service.pricing_type,
        ts_rank_cd(
            to_tsvector(
                'simple',
                coalesce(service.name, '') || ' ' || coalesce(service.category, '') || ' ' ||
                coalesce(service.description, '')
            ),
            websearch_to_tsquery('simple', p_query)
        )::real AS relevance
    FROM public.services AS service
    WHERE service.company_id = p_company_id
      AND service.is_active
      AND p_company_id IS NOT NULL
      AND btrim(p_query) <> ''
      AND p_limit BETWEEN 1 AND 10
      AND to_tsvector(
            'simple',
            coalesce(service.name, '') || ' ' || coalesce(service.category, '') || ' ' ||
            coalesce(service.description, '')
          ) @@ websearch_to_tsquery('simple', p_query)
    ORDER BY relevance DESC, service.name, service.id
    LIMIT p_limit;
$$;
COMMENT ON FUNCTION public.search_active_services(uuid, text, integer)
    IS 'Returns ranked active services for exactly one company; intended for the trusted backend.';

CREATE TABLE public.tool_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    request_id text NOT NULL CHECK (btrim(request_id) <> '' AND length(request_id) <= 200),
    tool_name text NOT NULL CHECK (btrim(tool_name) <> ''),
    request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    response jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tool_requests_company_request_tool_key UNIQUE (company_id, request_id, tool_name)
);
COMMENT ON TABLE public.tool_requests
    IS 'Idempotency ledger for state-changing agent tools; payloads and customer PII are deliberately excluded.';

ALTER TABLE public.tool_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tool_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tool_requests TO service_role;
CREATE INDEX tool_requests_company_created_idx ON public.tool_requests (company_id, created_at DESC);

CREATE FUNCTION public.create_lead_tool_workflow(
    p_company_id uuid,
    p_request_id text,
    p_request_hash text,
    p_customer jsonb,
    p_lead jsonb,
    p_project jsonb
)
RETURNS TABLE (customer_id uuid, lead_id uuid, project_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    ledger public.tool_requests%ROWTYPE;
    saved_customer_id uuid;
    saved_lead_id uuid;
    saved_project_id uuid;
BEGIN
    IF p_company_id IS NULL OR p_request_id IS NULL OR btrim(p_request_id) = ''
       OR length(p_request_id) > 200 OR p_request_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid tool workflow identity' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.tool_requests (company_id, request_id, tool_name, request_hash)
    VALUES (p_company_id, p_request_id, 'create_lead', p_request_hash)
    ON CONFLICT (company_id, request_id, tool_name) DO NOTHING
    RETURNING * INTO ledger;

    IF NOT FOUND THEN
        SELECT * INTO STRICT ledger
        FROM public.tool_requests
        WHERE company_id = p_company_id
          AND request_id = p_request_id
          AND tool_name = 'create_lead';
        IF ledger.request_hash <> p_request_hash THEN
            RAISE EXCEPTION 'Idempotency key was already used with different input' USING ERRCODE = '23505';
        END IF;
        IF ledger.response IS NULL THEN
            RAISE EXCEPTION 'Idempotent workflow is still in progress' USING ERRCODE = '40001';
        END IF;
        RETURN QUERY SELECT
            (ledger.response ->> 'customer_id')::uuid,
            (ledger.response ->> 'lead_id')::uuid,
            (ledger.response ->> 'project_id')::uuid,
            true;
        RETURN;
    END IF;

    INSERT INTO public.customers (company_id, name, email, phone, business_name, industry)
    VALUES (
        p_company_id,
        p_customer ->> 'name',
        nullif(p_customer ->> 'email', ''),
        nullif(p_customer ->> 'phone', ''),
        nullif(p_customer ->> 'business_name', ''),
        nullif(p_customer ->> 'industry', '')
    ) RETURNING id INTO saved_customer_id;

    INSERT INTO public.leads (company_id, customer_id, source, intent, status, estimated_value)
    VALUES (
        p_company_id,
        saved_customer_id,
        nullif(p_lead ->> 'source', ''),
        nullif(p_lead ->> 'intent', ''),
        p_lead ->> 'status',
        nullif(p_lead ->> 'estimated_value', '')::numeric
    ) RETURNING id INTO saved_lead_id;

    INSERT INTO public.projects (
        company_id, customer_id, service_type, product_category,
        product_count, image_count, deadline, status
    ) VALUES (
        p_company_id,
        saved_customer_id,
        nullif(p_project ->> 'service_type', ''),
        nullif(p_project ->> 'product_category', ''),
        nullif(p_project ->> 'product_count', '')::integer,
        nullif(p_project ->> 'image_count', '')::integer,
        nullif(p_project ->> 'deadline', '')::timestamptz,
        p_project ->> 'status'
    ) RETURNING id INTO saved_project_id;

    UPDATE public.tool_requests
    SET response = jsonb_build_object(
        'customer_id', saved_customer_id,
        'lead_id', saved_lead_id,
        'project_id', saved_project_id
    )
    WHERE id = ledger.id;

    RETURN QUERY SELECT saved_customer_id, saved_lead_id, saved_project_id, false;
END;
$$;
COMMENT ON FUNCTION public.create_lead_tool_workflow(uuid, text, text, jsonb, jsonb, jsonb)
    IS 'Atomically creates customer, lead, and project records and replays a completed result for duplicate requests.';

REVOKE ALL ON FUNCTION public.search_active_services(uuid, text, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_lead_tool_workflow(uuid, text, text, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_active_services(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_lead_tool_workflow(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;

COMMIT;
