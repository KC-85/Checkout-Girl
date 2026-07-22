# Checkout Girl

A responsive artist website built with semantic HTML5, Tailwind CSS, custom CSS3 and TypeScript, with a small Go API for contact-form email.

## Local development

Copy `.env.example` to your preferred local environment file and set the SMTP and mail addresses. The Go service reads environment variables directly, so export them before starting it:

```sh
set -a
. ./.env
set +a
cd backend
go run .
```

Then visit `http://localhost:8080`. The server hosts the static site, exposes `POST /api/contact`, and provides `GET /health` for deployment health checks.

To rebuild the browser JavaScript after editing `frontend/assets/js/main.ts`:

```sh
tsc -p frontend/tsconfig.json
```

Tailwind is loaded through its browser CDN. Because the contact form calls a same-origin API, deploy the static files and Go binary together or proxy `/api/contact` to the Go service.

Run the backend tests with:

```sh
cd backend
go test ./...
```

## Project structure

```text
frontend/  Static HTML, CSS, TypeScript and public assets
backend/   Go HTTP server, mail delivery and backend tests
```

The Go server automatically finds `frontend/` when started from either the repository root or the `backend/` directory. Set `STATIC_DIR` explicitly when your deployment uses a different layout.

## Content to connect

The music and live-date areas intentionally avoid placeholder external URLs. Add Checkout Girl's official streaming, social and booking links when they are ready.
