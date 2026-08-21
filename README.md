# Checkout Girl

A responsive, frontend-only artist website built with semantic HTML5, Tailwind CSS, custom CSS3 and TypeScript.

## Local development

Install the development dependency and start Vite:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

Create and preview a production build with:

```sh
npm run build
npm run preview
```

Vite compiles the TypeScript entry point and bundles the production site into `frontend/dist/`. Tailwind is loaded through its browser CDN, so there is no separate CSS build step.

## Deployment

The repository includes `vercel.json`, so Vercel will run the production build and deploy `frontend/dist/`. Import the repository into Vercel with the project root left at the repository root; no additional build settings are required.

## Project structure

```text
frontend/  Static HTML, CSS, TypeScript and public assets
```

## Content to connect

The music, live-date and contact areas intentionally avoid placeholder external URLs. Add Checkout Girl's official streaming, social and booking links when they are ready.
