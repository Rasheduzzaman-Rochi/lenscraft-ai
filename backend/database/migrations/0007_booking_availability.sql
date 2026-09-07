-- Guarantee that one company cannot confirm two bookings at the same instant.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE status = 'confirmed'
        GROUP BY company_id, date_time
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce booking availability: duplicate confirmed slots exist'
            USING ERRCODE = '23505';
    END IF;
END;
$$;

CREATE UNIQUE INDEX bookings_company_confirmed_datetime_uidx
    ON public.bookings (company_id, date_time)
    WHERE status = 'confirmed';

COMMENT ON INDEX public.bookings_company_confirmed_datetime_uidx
    IS 'Final concurrency guard: only one confirmed booking per company and exact appointment instant.';

COMMIT;
