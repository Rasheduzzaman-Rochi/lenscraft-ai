# LensCraft Studio frontend

Premium client-facing website for LensCraft Studio, built with Next.js 15,
TypeScript, Tailwind CSS, shadcn-style UI primitives, and Framer Motion.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

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

Forms currently validate and preview their completed state locally. They do not
submit data or call backend APIs. Only public browser configuration may use
`NEXT_PUBLIC_` environment variables; Supabase and Retell credentials must remain
in the backend.
