-- Knowledge retrieval functions for the trusted backend service role.
-- Apply after 0003. Both functions require an explicit company UUID and never
-- expose cross-tenant rows. Client roles cannot execute these RPC functions.
BEGIN;

GRANT USAGE ON SCHEMA extensions TO service_role;

ALTER TABLE public.knowledge_documents
    ADD COLUMN embedding_model text;
ALTER TABLE public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_embedding_model_pair_check
    CHECK (
        (embedding IS NULL AND embedding_model IS NULL)
        OR (embedding IS NOT NULL AND btrim(embedding_model) <> '')
    ) NOT VALID;
COMMENT ON COLUMN public.knowledge_documents.embedding_model
    IS 'Provider/model identifier required for new embeddings; legacy embeddings must be backfilled before constraint validation.';

CREATE INDEX knowledge_documents_search_idx
    ON public.knowledge_documents
    USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE FUNCTION public.search_knowledge_documents_text(
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
            to_tsvector('simple', coalesce(document.title, '') || ' ' || coalesce(document.content, '')),
            websearch_to_tsquery('simple', p_query)
        )::double precision AS relevance,
        document.created_at
    FROM public.knowledge_documents AS document
    WHERE document.company_id = p_company_id
      AND btrim(p_query) <> ''
      AND to_tsvector('simple', coalesce(document.title, '') || ' ' || coalesce(document.content, ''))
          @@ websearch_to_tsquery('simple', p_query)
    ORDER BY relevance DESC, document.created_at DESC, document.id
    LIMIT greatest(1, least(p_limit, 20));
$$;

CREATE FUNCTION public.search_knowledge_documents_vector(
    p_company_id uuid,
    p_query_embedding extensions.vector,
    p_embedding_model text,
    p_match_threshold double precision DEFAULT 0.70,
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
        (1 - (document.embedding OPERATOR(extensions.<=>) p_query_embedding))::double precision AS relevance,
        document.created_at
    FROM public.knowledge_documents AS document
    WHERE document.company_id = p_company_id
      AND document.embedding IS NOT NULL
      AND document.embedding_model = p_embedding_model
      AND extensions.vector_dims(document.embedding) = extensions.vector_dims(p_query_embedding)
      AND (1 - (document.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= p_match_threshold
    ORDER BY document.embedding OPERATOR(extensions.<=>) p_query_embedding,
             document.created_at DESC,
             document.id
    LIMIT greatest(1, least(p_limit, 20));
$$;

COMMENT ON FUNCTION public.search_knowledge_documents_text(uuid, text, integer)
    IS 'Tenant-scoped full-text fallback for knowledge retrieval.';
COMMENT ON FUNCTION public.search_knowledge_documents_vector(uuid, extensions.vector, text, double precision, integer)
    IS 'Tenant-scoped cosine-similarity retrieval for same-dimension pgvector embeddings.';

REVOKE ALL ON FUNCTION public.search_knowledge_documents_text(uuid, text, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_knowledge_documents_vector(uuid, extensions.vector, text, double precision, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge_documents_text(uuid, text, integer)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.search_knowledge_documents_vector(uuid, extensions.vector, text, double precision, integer)
    TO service_role;

COMMIT;
