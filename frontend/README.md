# Social Media Scheduler Frontend

React + Vite frontend for the existing Social Media Scheduler backend.

## Local development

1. Install frontend dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_API_URL` to the backend base URL in `.env.local`.
4. Start Vite with `npm run dev`.

The development server forwards `/api` requests to `VITE_API_URL`.

## Vercel deployment

Set `VITE_API_URL` in the Vercel project environment variables to the backend
base URL, for example `https://social-media-scheduler-fzmm.onrender.com`.
Deploy with the Vercel project root set to this `frontend` folder and the build
command `npm run build`. Vercel serves the static site from `dist` and the
`api/[...path].js` function forwards same-origin `/api` requests to the backend.
The image picker limits uploads to 4 MB to stay within Vercel's function request
payload limit; the backend itself accepts files up to 5 MB.

The proxy allows the browser UI to work without changing the existing backend's
CORS configuration. Do not put credentials in `VITE_API_URL`; the URL is not a
secret.

## Publishing

Instagram and LinkedIn API integrations are not configured yet. When a scheduled
post becomes due, the backend records the failed attempt using
`PUBLISHING_NOT_CONFIGURED`; it does not create simulated or real social posts.
The frontend displays that status and failure message.
