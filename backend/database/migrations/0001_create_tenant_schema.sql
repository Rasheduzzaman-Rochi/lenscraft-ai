-- LensCraft AI: apply migrations once, in filename order, as the Supabase
-- postgres/migration owner. Requires Supabase auth.users, auth.uid(), and the
-- anon, authenticated, and service_role roles. No remote database is modified
-- merely by creating these files. Each migration is transactional.
--
-- Identity assumption: one auth user belongs to one company. A future
-- many-company user model should introduce a separate membership table.
-- Deletion is RESTRICT by default to protect business history. Delete dependent
-- records explicitly in an authorized retention workflow before a tenant purge.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Avoid silently moving an existing extension used by other applications.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_extension e
        JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector' AND n.nspname = 'extensions'
    ) THEN
        RAISE EXCEPTION 'pgvector must be installed in schema extensions; review its existing installation before applying LensCraft migrations';
    END IF;
END;
$$;

CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> ''),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    email text,
    phone text,
    website text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.companies IS 'Tenant root: one photography business per row.';
COMMENT ON COLUMN public.companies.slug IS 'Globally unique lowercase URL identifier.';

CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (btrim(name) <> ''),
    email text NOT NULL CHECK (btrim(email) <> ''),
    role text NOT NULL DEFAULT 'member' CHECK (btrim(role) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.users IS 'Company staff profiles linked to Supabase Auth; not customer accounts.';
COMMENT ON COLUMN public.users.id IS 'Existing auth.users UUID, supplied explicitly; never generated independently.';
COMMENT ON COLUMN public.users.role IS 'Reserved application role. Role-based write authorization is not defined yet.';

CREATE TABLE public.company_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
    currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    timezone text NOT NULL DEFAULT 'UTC' CHECK (btrim(timezone) <> ''),
    tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    business_hours jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(business_hours) = 'object'),
    settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.company_settings IS 'At most one configuration row per company: currency, local time, tax, and business preferences.';
COMMENT ON COLUMN public.company_settings.tax_rate IS 'Percentage points: 7.5 means 7.5 percent, not 0.075.';
COMMENT ON COLUMN public.company_settings.currency IS 'Three-letter ISO 4217 code; supported-code validation belongs to future configuration workflows.';
COMMENT ON COLUMN public.company_settings.timezone IS 'IANA time zone name, validated by a database trigger.';
COMMENT ON COLUMN public.company_settings.settings IS 'Non-secret tenant preferences only; do not store API keys or credentials here.';

CREATE TABLE public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (btrim(name) <> ''),
    category text,
    description text,
    pricing_type text NOT NULL CHECK (btrim(pricing_type) <> ''),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.services IS 'Company photography service catalog, with soft deactivation and extensible pricing types.';

CREATE TABLE public.pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    rule_type text NOT NULL CHECK (btrim(rule_type) <> ''),
    value numeric(18,4) NOT NULL CHECK (value <> 'NaN'::numeric),
    condition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(condition) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pricing_rules IS 'Declarative pricing inputs owned by a service; tenant ownership is inherited from services.';
COMMENT ON COLUMN public.pricing_rules.value IS 'Rule-specific amount, rate, or signed adjustment; units and interpretation depend on rule_type.';

CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (btrim(name) <> ''),
    email text,
    phone text,
    business_name text,
    industry text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customers_company_id_id_key UNIQUE (company_id, id)
);
COMMENT ON TABLE public.customers IS 'Company-scoped prospects and clients; contact details may be shared by multiple customers.';

CREATE TABLE public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id uuid,
    source text,
    intent text,
    status text NOT NULL DEFAULT 'new' CHECK (btrim(status) <> ''),
    estimated_value numeric(18,4) CHECK (estimated_value >= 0 AND estimated_value <> 'NaN'::numeric),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT leads_customer_same_company_fk FOREIGN KEY (company_id, customer_id)
        REFERENCES public.customers(company_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.leads IS 'Sales opportunities; customer association may be added after initial qualification.';

CREATE TABLE public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id uuid NOT NULL,
    service_type text,
    product_category text,
    product_count integer CHECK (product_count >= 0),
    image_count integer CHECK (image_count >= 0),
    deadline timestamptz,
    status text NOT NULL DEFAULT 'draft' CHECK (btrim(status) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT projects_customer_same_company_fk FOREIGN KEY (company_id, customer_id)
        REFERENCES public.customers(company_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.projects IS 'Customer photography jobs and delivery requirements, scoped to the same company as the customer.';
COMMENT ON COLUMN public.projects.service_type IS 'Descriptive job service type; deliberately not a foreign key to the mutable service catalog.';

CREATE TABLE public.quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    base_price numeric(18,4) NOT NULL DEFAULT 0 CHECK (base_price >= 0 AND base_price <> 'NaN'::numeric),
    addons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(addons) = 'array'),
    discount numeric(18,4) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <> 'NaN'::numeric),
    tax numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax >= 0 AND tax <> 'NaN'::numeric),
    total_price numeric(18,4) NOT NULL CHECK (total_price >= 0 AND total_price <> 'NaN'::numeric),
    status text NOT NULL DEFAULT 'draft' CHECK (btrim(status) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.quotes IS 'Project quote records; a project can have multiple quotes. Tenant ownership is inherited from projects.';
COMMENT ON COLUMN public.quotes.addons IS 'Array of quote line items; item schema and total calculation are deferred to the pricing workflow.';
COMMENT ON COLUMN public.quotes.discount IS 'Absolute monetary discount, not a percentage.';
COMMENT ON COLUMN public.quotes.tax IS 'Absolute monetary tax, not a percentage.';
COMMENT ON COLUMN public.quotes.total_price IS 'Stored monetary total in company currency; no pricing calculation is implemented by this migration.';

CREATE TABLE public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id uuid,
    retell_call_id text UNIQUE CHECK (btrim(retell_call_id) <> ''),
    duration integer CHECK (duration >= 0),
    transcript text,
    summary text,
    intent text,
    outcome text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calls_customer_same_company_fk FOREIGN KEY (company_id, customer_id)
        REFERENCES public.customers(company_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.calls IS 'Voice call records and asynchronously populated transcripts and outcomes; unknown callers are allowed.';
COMMENT ON COLUMN public.calls.duration IS 'Duration in whole seconds; NULL until known.';
COMMENT ON COLUMN public.calls.retell_call_id IS 'Unique external provider call ID for lookup and webhook deduplication; NULL before assignment.';

CREATE TABLE public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    customer_id uuid NOT NULL,
    calendar_event_id text CHECK (btrim(calendar_event_id) <> ''),
    date_time timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (btrim(status) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bookings_calendar_event_key UNIQUE (company_id, calendar_event_id),
    CONSTRAINT bookings_customer_same_company_fk FOREIGN KEY (company_id, customer_id)
        REFERENCES public.customers(company_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.bookings IS 'Customer appointments; calendar identifiers are unique within a company, assuming one calendar integration per company.';
COMMENT ON COLUMN public.bookings.date_time IS 'Absolute appointment instant; display using the company IANA time zone.';

CREATE TABLE public.knowledge_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    title text NOT NULL CHECK (btrim(title) <> ''),
    content text NOT NULL CHECK (btrim(content) <> ''),
    embedding extensions.vector,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.knowledge_documents IS 'Tenant-isolated RAG source content with optional embeddings pending generation.';
COMMENT ON COLUMN public.knowledge_documents.embedding IS 'Dimension-unconstrained until an embedding model is selected. Before retrieval rollout, enforce a consistent model/dimension and add a matching vector index in a new migration.';

-- Enable RLS and remove Supabase default API grants in the SAME transaction as
-- table creation: there is no window of unrestricted API access between files.
-- Migration 0003 adds tenant SELECT policies; client writes remain denied.
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'companies', 'users', 'company_settings', 'services', 'pricing_rules',
        'customers', 'leads', 'projects', 'quotes', 'calls', 'bookings',
        'knowledge_documents'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
    END LOOP;
END;
$$;

COMMIT;
