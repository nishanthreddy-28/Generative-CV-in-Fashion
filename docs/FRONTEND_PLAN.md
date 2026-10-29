# Frontend-first implementation

The user approved a frontend-first sequence on 2026-10-29. This document supersedes the Next.js-specific architecture guidance for the active React/Vite frontend. Existing code and design documents are retained for historical reference.

## Run

Use Node.js 22.12+ (or a compatible newer supported version):

```sh
cd frontend
npm install
npm run dev
npm run build
```

Open the local URL printed by Vite. `/` is the landing page and `/dashboard` is the public studio preview. No Firebase configuration or account is required for this checkpoint. There is no authentication in the preview.

## Organization

- `src/studio/`: active foundation shell, route inventory and scoped design tokens.
- `src/pages/`, `src/layouts/`, `src/context/`: earlier implementation preserved; not active in this checkpoint.
- Subsequent workflows will separate page components, shared controls, service interfaces, browser-local demo persistence and future API adapters.
- Demo login and local role selection must be labeled simulation, never represented as server authorization.
- Backend integration will be implemented later; Java/Spring Boot and PostgreSQL remain planned, not installed.

## Sequence

0. Review foundations and responsive shell.
1. Frontend authentication/onboarding/profile forms, clearly labeled demo sessions.
2. Photos with file validation, previews and local persistence.
3. Wardrobe CRUD and metadata.
4. Catalog filters, details and admin editing in explicit demo mode.
5. Try-on input review and persistent unavailable sessions; no fake output.
6. History and saved views (saving requires a real completed result).
7. Admin frontend and data-derived local metrics, without security claims.
8. Frontend journey verification, responsive review and backend integration contracts.

Complete and review one workflow at a time. Stable tags require all applicable checks and design review. Incomplete work uses explicit preview checkpoint names.

## Privacy and model boundaries

Do not upload personal images to Figma. Editorial imagery is presentation content, not generated try-on output. Future local image storage will be explicitly explained to users and separated from later authenticated backend storage. Model integration must produce an actual stored result before a session becomes COMPLETED.
