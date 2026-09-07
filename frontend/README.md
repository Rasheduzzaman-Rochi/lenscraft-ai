# LensCraft Studio frontend

Premium client-facing website for LensCraft Studio, built with Next.js 15,
TypeScript, Tailwind CSS, shadcn-style UI primitives, and Framer Motion.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and configure the FastAPI origin, the
server-only Retell signing key, and the fixed company UUID. Only
`NEXT_PUBLIC_API_URL` is public; never add `NEXT_PUBLIC_` to either secret-side
setting.

## Production build

```sh
npm run build
npm run start
```

## Routes

- `/` — studio landing page
- `/services` — photography services
- `/portfolio` — filterable portfolio gallery
- `/contact` — project enquiry form foundation
- `/booking` — booking request form foundation

The current visual placeholders are CSS-generated and have no external image
dependency. Replace them with optimized `next/image` assets when approved studio
photography becomes available.

Browser forms submit to same-origin Next.js route handlers. Those handlers
validate input, add the trusted company UUID, sign the exact request body on the
server, and call the existing FastAPI Retell-tool endpoints. Supabase credentials
remain in the backend, and the Retell key is never included in browser code.
