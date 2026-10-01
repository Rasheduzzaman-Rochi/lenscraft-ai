BEGIN;

-- Upgrade tenant-scoped full-text fallback to use english stemming and OR logic 
-- for conversational natural-language queries.
-- Applying this migration requires backend/db redeployment (Supabase migration).

CREATE OR REPLACE FUNCTION public.search_knowledge_documents_text(
    p_company_id uuid,
    p_query text,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    relevance double precision,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT
        document.id,
        document.title,
        left(document.content, 50000) AS content,
        ts_rank_cd(
            to_tsvector('english', coalesce(document.title, '') || ' ' || coalesce(document.content, '')),
            to_tsquery('english', replace(nullif(plainto_tsquery('english', p_query)::text, ''), '&', '|'))
        )::double precision AS relevance,
        document.created_at
    FROM public.knowledge_documents AS document
    WHERE document.company_id = p_company_id
      AND nullif(plainto_tsquery('english', p_query)::text, '') IS NOT NULL
      AND to_tsvector('english', coalesce(document.title, '') || ' ' || coalesce(document.content, ''))
          @@ to_tsquery('english', replace(nullif(plainto_tsquery('english', p_query)::text, ''), '&', '|'))
    ORDER BY relevance DESC, document.created_at DESC, document.id
    LIMIT greatest(1, least(p_limit, 20));
$$;

COMMENT ON FUNCTION public.search_knowledge_documents_text(uuid, text, integer)
    IS 'Tenant-scoped full-text fallback for knowledge retrieval with natural-language OR logic.';

COMMIT;
