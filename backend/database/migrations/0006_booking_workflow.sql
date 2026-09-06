-- Persist all booking tool fields and create customer/booking records atomically.
BEGIN;

ALTER TABLE public.bookings
    ADD COLUMN service_type text,
    ADD COLUMN notes text,
    ADD CONSTRAINT bookings_service_type_check
        CHECK (service_type IS NULL OR (btrim(service_type) <> '' AND length(service_type) <= 500)),
    ADD CONSTRAINT bookings_notes_length_check
        CHECK (notes IS NULL OR length(notes) <= 5000);

COMMENT ON COLUMN public.bookings.service_type
    IS 'Photography service requested for the appointment, captured at booking time.';
COMMENT ON COLUMN public.bookings.notes
    IS 'Optional customer-supplied appointment notes; never use this field for credentials.';

CREATE INDEX bookings_company_service_datetime_idx
    ON public.bookings (company_id, service_type, date_time);

CREATE FUNCTION public.create_booking_tool_workflow(
    p_company_id uuid,
    p_customer jsonb,
    p_date_time timestamptz,
    p_service_type text,
    p_notes text DEFAULT NULL
)
RETURNS TABLE (customer_id uuid, booking_id uuid, status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    saved_customer_id uuid;
    saved_booking_id uuid;
BEGIN
    IF p_company_id IS NULL OR p_date_time IS NULL OR p_date_time <= now()
       OR p_service_type IS NULL OR btrim(p_service_type) = ''
       OR length(p_service_type) > 500 OR length(p_notes) > 5000 THEN
        RAISE EXCEPTION 'Invalid booking workflow input' USING ERRCODE = '23514';
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

    INSERT INTO public.bookings (
        company_id, customer_id, date_time, service_type, notes, status
    ) VALUES (
        p_company_id,
        saved_customer_id,
        p_date_time,
        btrim(p_service_type),
        nullif(btrim(p_notes), ''),
        'pending'
    ) RETURNING id INTO saved_booking_id;

    RETURN QUERY SELECT saved_customer_id, saved_booking_id, 'pending'::text;
END;
$$;

COMMENT ON FUNCTION public.create_booking_tool_workflow(uuid, jsonb, timestamptz, text, text)
    IS 'Atomically creates a tenant customer and pending booking for the trusted backend.';

REVOKE ALL ON FUNCTION public.create_booking_tool_workflow(uuid, jsonb, timestamptz, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_tool_workflow(uuid, jsonb, timestamptz, text, text)
    TO service_role;

COMMIT;
