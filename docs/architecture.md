# Architecture Overview

This project follows a **feature-first modular architecture** aligned with Domain-Driven Design (DDD) principles.

## Folder Structure

```
src/
├── app/              # Next.js App Router — routing ONLY (pages, layouts, API routes)
├── features/         # Business domains — self-contained feature modules
├── server/           # Server-only code — never imported on the client
├── shared/           # Cross-feature reusable UI + utilities
├── lib/              # Third-party integrations & wrappers
├── store/            # Global client-side state (Zustand)
├── types/            # Shared TypeScript types across the app
└── config/           # App configuration & env validation
middleware.ts         # Next.js Edge middleware for route protection
```

## Structure Rules

| Directory | Rule |
|---|---|
| `src/app/` | **Routing only.** No business logic. Pages import from `features/`. |
| `src/features/` | **Self-contained domain modules.** Each has `actions/`, `components/`, `hooks/`, `schemas/`, `services/`, `types.ts`. |
| `src/server/` | **Server-only.** Never import in client components. Contains DB repositories, auth helpers, storage. |
| `src/shared/` | **Truly shared code.** Only things used by 2+ features. |
| `src/lib/` | **Third-party wrappers.** Supabase clients, AI prompts, validation schemas. |
| `src/store/` | **Global UI state only.** No server data (use React Query / SWR for that). |
| `src/types/` | **Shared types.** API contracts, DB types, env types. |
| `middleware.ts` | **Route protection.** Auth guards at the edge. |

## Feature Module Anatomy

```
features/wardrobe/
├── actions/          # Server Actions (mutations, called from client)
│   └── uploadItem.action.ts
├── components/       # React components owned by this feature
│   └── WardrobeGrid.tsx
├── hooks/            # Client-side hooks (data fetching, UI state)
│   └── useWardrobeItems.ts
├── schemas/          # Zod validation schemas (shared server+client)
│   └── wardrobe.schema.ts
├── services/         # Client-side API callers (fetch wrappers)
│   └── wardrobe.service.ts
├── index.ts          # Public API barrel export
└── types.ts          # Feature-specific TypeScript types
```

## Server vs Client Boundary

```
CLIENT                    │  SERVER
──────────────────────────┼───────────────────────────────
features/*/components/    │  features/*/actions/
features/*/hooks/         │  server/db/*.repository.ts
features/*/services/      │  server/auth/
lib/supabase/client.ts    │  lib/supabase/server.ts
store/                    │  server/storage/
```

## Design Principles

1. **Feature isolation** — features don't import from each other directly
2. **Server/Client separation** — `server/` code is never bundled client-side
3. **Repository pattern** — all DB queries behind `*.repository.ts` interfaces
4. **Server Actions over REST** — prefer co-located actions for mutations
5. **Zod-first validation** — schemas in `features/*/schemas/` are the source of truth
