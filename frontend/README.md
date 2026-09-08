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
- `/admin/bookings` — authenticated booking operations
- `/admin/leads` — authenticated lead operations

The current visual placeholders are CSS-generated and have no external image
dependency. Replace them with optimized `next/image` assets when approved studio
photography becomes available.

Browser forms submit to same-origin Next.js route handlers. Those handlers
validate input, add the trusted company UUID, sign the exact request body on the
server, and call the existing FastAPI Retell-tool endpoints. Supabase credentials
remain in the backend, and the Retell key is never included in browser code.
