# LensCraft Studio frontend

Premium client-facing website for LensCraft Studio, built with Next.js 15,
TypeScript, Tailwind CSS, shadcn-style UI primitives, and Framer Motion.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and configure the Supabase public Auth
values, FastAPI origin, server-only admin API key, and fixed company UUID.
`ADMIN_API_KEY` must match the backend deployment and must never use a
`NEXT_PUBLIC_` prefix.

The voice assistant talks to Retell directly and never uses FastAPI:

```text
Browser -> /api/voice/session -> Retell create-web-call (access token)
Browser -> Retell -> Retell Conversation Flow -> Supabase RPCs
```

`/api/voice/session` is a Next.js route that only creates the Retell web-call
access token required by `retell-client-js-sdk`; it performs no service search,
FAQ, quote, lead, availability, booking, or booking-status work. It needs the
production `NEXT_PUBLIC_RETELL_AGENT_ID` and the server-only `RETELL_API_KEY`,
configured on the running Next.js service. The Retell custom-function secret
stays in Retell and never belongs in this service.

## Production build

```sh
npm run build
npm run start
```

For Dokploy, configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` for the browser build. Configure
`NEXT_PUBLIC_API_URL`, `ADMIN_API_KEY`, and `LENSCRAFT_COMPANY_ID` on the
running Next.js service. Admin server code reads the API URL dynamically at
runtime; the API key and company UUID are never bundled into client JavaScript.
The backend service must receive the same `ADMIN_API_KEY` and must map it into
its container environment.

## Routes

- `/` — studio landing page
- `/services` — photography services
- `/portfolio` — filterable portfolio gallery
- `/contact` — project enquiry form foundation
- `/booking` — booking request form foundation
- `/admin` — authenticated studio overview
- `/admin/services`, `/admin/pricing` — service catalog and pricing rules
- `/admin/bookings`, `/admin/customers`, `/admin/leads`, `/admin/projects` — operations
- `/admin/knowledge` — voice-agent knowledge base documents
- `/admin/settings` — studio settings, profile, and sign out

The current visual placeholders are CSS-generated and have no external image
dependency. Replace them with optimized `next/image` assets when approved studio
photography becomes available.

The `/booking` and `/contact` forms (not the voice agent) submit to same-origin
Next.js route handlers. Those handlers validate input, add the trusted company
UUID, sign the exact request body on the server, and call FastAPI's
`create-booking`, `check-booking-availability`, and `create-lead` endpoints.
This is a deliberate website-forms-only path; the voice agent does not use it.
Supabase credentials remain in the backend, and the Retell key is never included
in browser code.

The Admin Dashboard uses `Admin browser -> Next.js admin routes (Supabase Auth +
admin role) -> FastAPI /api/v1/admin -> Supabase`.
