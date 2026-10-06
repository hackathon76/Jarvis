# SmartCampus

Frontend (`public/index.html`) + Node backend (`server.js`, no dependencies) + Supabase (auth + database).

## Run
1. Supabase dashboard → SQL Editor → paste and run `supabase/schema.sql`.
2. Authentication → Providers → Email. For a quick demo, turn **Confirm email** off.
3. `.env.local` already holds your Supabase URL + publishable key (see `.env.example`).
4. `npm start` → open http://localhost:3000

Without Supabase configured the app falls back to a local demo mode (data saved in the browser).

## API (all need `Authorization: Bearer <supabase access token>`)
`GET/POST /api/profile` · `GET/POST /api/resources` · `DELETE /api/resources/:id` · `GET/POST /api/transactions`
Public: `GET /api/health`, `GET /api/config`.

## Deploy
Any Node host (Render, Railway, Fly): set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; start command `npm start`.
