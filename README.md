# Checkout Girl

A responsive, frontend-only artist website built with semantic HTML5, Tailwind CSS, custom CSS3 and TypeScript.

## Local development

Serve the `frontend/` directory with any static file server. For example:

```sh
python3 -m http.server 8080 --directory frontend
```

Then visit `http://localhost:8080`.

To rebuild the browser JavaScript after editing `frontend/assets/js/main.ts`:

```sh
tsc -p frontend/tsconfig.json
```

Tailwind is loaded through its browser CDN, so there is no CSS build step.

## Project structure

```text
frontend/  Static HTML, CSS, TypeScript and public assets
```

## Content to connect

The music, live-date and contact areas intentionally avoid placeholder external URLs. Add Checkout Girl's official streaming, social and booking links when they are ready.
