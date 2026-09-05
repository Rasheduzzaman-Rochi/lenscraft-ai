-- Apply after 0001. Indexes favor tenant filters, recent activity, status queues,
-- contact lookup, and parent-child joins. Unique constraints already index slugs,
-- company settings, external identifiers, primary keys, and customer tenant IDs.
BEGIN;

CREATE UNIQUE INDEX users_company_email_uidx ON public.users (company_id, lower(email));
CREATE INDEX services_company_active_category_idx ON public.services (company_id, is_active, category);
CREATE INDEX pricing_rules_service_type_idx ON public.pricing_rules (service_id, rule_type);
CREATE INDEX customers_company_email_idx ON public.customers (company_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX customers_company_phone_idx ON public.customers (company_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_company_name_idx ON public.customers (company_id, lower(name));
CREATE INDEX leads_company_status_created_idx ON public.leads (company_id, status, created_at DESC);
CREATE INDEX leads_company_customer_idx ON public.leads (company_id, customer_id);
CREATE INDEX projects_company_status_deadline_idx ON public.projects (company_id, status, deadline);
CREATE INDEX projects_company_customer_idx ON public.projects (company_id, customer_id);
CREATE INDEX quotes_project_created_idx ON public.quotes (project_id, created_at DESC);
CREATE INDEX calls_company_created_idx ON public.calls (company_id, created_at DESC);
CREATE INDEX calls_company_customer_idx ON public.calls (company_id, customer_id);
CREATE INDEX bookings_company_status_datetime_idx ON public.bookings (company_id, status, date_time);
CREATE INDEX bookings_company_customer_idx ON public.bookings (company_id, customer_id);
CREATE INDEX knowledge_documents_company_created_idx ON public.knowledge_documents (company_id, created_at DESC);
-- Deliberately no ANN index on an unconstrained vector. Add a dimension-specific
-- HNSW/IVFFlat index once the embedding model and distance metric are selected.

CREATE SCHEMA IF NOT EXISTS lenscraft_private;
REVOKE ALL ON SCHEMA lenscraft_private FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA lenscraft_private IS 'Internal trigger and RLS helpers; keep out of Supabase exposed API schemas.';

CREATE FUNCTION lenscraft_private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION lenscraft_private.set_updated_at() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION lenscraft_private.set_updated_at() IS 'Sets a fresh UTC-compatible modification instant on every row update.';

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'companies', 'users', 'company_settings', 'services', 'pricing_rules',
        'customers', 'leads', 'projects', 'quotes', 'calls', 'bookings',
        'knowledge_documents'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION lenscraft_private.set_updated_at()',
            table_name
        );
    END LOOP;
END;
$$;

CREATE FUNCTION lenscraft_private.validate_company_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
        RAISE EXCEPTION 'Unknown time zone: %', NEW.timezone USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION lenscraft_private.validate_company_timezone() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_company_timezone
    BEFORE INSERT OR UPDATE OF timezone ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION lenscraft_private.validate_company_timezone();
COMMENT ON FUNCTION lenscraft_private.validate_company_timezone() IS 'Rejects timezone names not recognized by PostgreSQL.';

COMMIT;
