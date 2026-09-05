-- Apply after 0002 as the same trusted migration owner (Supabase postgres).
-- Baseline: anon has no access; authenticated users can SELECT their own
-- company's data. There are intentionally NO client INSERT/UPDATE/DELETE grants
-- or policies, including for profile role/company changes. Future migrations
-- must add write privileges together with role-aware USING/WITH CHECK policies.
--
-- Company onboarding and user membership provisioning currently require a trusted
-- server/admin. Insert public.users only after the corresponding auth.users row
-- exists; there is no automatic tenant assignment or signup trigger.
-- service_role bypasses RLS in Supabase: never expose its key to clients and
-- always validate tenant authorization in future privileged server workflows.
BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA lenscraft_private TO authenticated;

-- A no-argument helper only returns the caller's company. SECURITY DEFINER
-- avoids recursive RLS queries on public.users. Its trusted owner must retain
-- RLS bypass/ownership; do not FORCE RLS on users without redesigning this helper.
-- All objects are qualified and search_path is empty to prevent object shadowing.
CREATE FUNCTION lenscraft_private.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT u.company_id
    FROM public.users AS u
    WHERE u.id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION lenscraft_private.current_company_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lenscraft_private.current_company_id() TO authenticated;
COMMENT ON FUNCTION lenscraft_private.current_company_id() IS 'Looks up the authenticated user tenant using trusted membership data; no user-controlled tenant argument.';

CREATE POLICY companies_tenant_select ON public.companies
    FOR SELECT TO authenticated
    USING (id = (SELECT lenscraft_private.current_company_id()));

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'company_settings', 'services', 'customers', 'leads',
        'projects', 'calls', 'bookings', 'knowledge_documents'
    ] LOOP
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id = (SELECT lenscraft_private.current_company_id()))',
            table_name || '_tenant_select', table_name
        );
    END LOOP;
END;
$$;

CREATE POLICY pricing_rules_tenant_select ON public.pricing_rules
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.services AS s
        WHERE s.id = pricing_rules.service_id
          AND s.company_id = (SELECT lenscraft_private.current_company_id())
    ));

CREATE POLICY quotes_tenant_select ON public.quotes
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.projects AS p
        WHERE p.id = quotes.project_id
          AND p.company_id = (SELECT lenscraft_private.current_company_id())
    ));

GRANT SELECT ON TABLE
    public.companies, public.users, public.company_settings, public.services,
    public.pricing_rules, public.customers, public.leads, public.projects,
    public.quotes, public.calls, public.bookings, public.knowledge_documents
TO authenticated;

COMMIT;
