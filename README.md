# Drape & Drop

Android-first personal wardrobe and styling application. `main` is the integration branch for the Expo frontend, Supabase Auth integration, FastAPI security/profile/preferences foundation and versioned database migration.

The source is consolidated; the application is **not yet functional end-to-end against hosted Supabase**. Profile/preferences APIs are implemented locally and intentionally fail closed until hosted security verification passes. Wardrobe, catalog, outfits, recommendations, try-on processing and account deletion still lack backend implementations. No demo accounts, fabricated records or simulated AI results are used by the active app.

- [Master workflow status and consolidation record](docs/WORKFLOW_STATUS.md)
- [Current architecture](docs/architecture.md)
- [Local setup](QUICK_START.md)
- [Mobile setup](mobile/README.md)
- [Backend setup and checks](backend/README.md)
- [Database migration/security setup](supabase/README.md)
- [Supabase Auth setup and pending acceptance](docs/backend/frontend-supabase-auth-integration.md)
- [Preserved 35-contract inventory](docs/backend/api-requirements.md)
- [Version and checkpoint ledger](docs/VERSIONS.md)
- [Figma Android direction](https://www.figma.com/design/IOurQ8W4mZAxVONkjql8uq)

Run the frontend from `mobile/` and FastAPI from `backend/`. Public introduction and `/preview` are available without account data. Preview does not save changes or grant administrator access. Native sessions use SecureStore; web sessions are intentionally memory-only. Google sign-in is not implemented.

All older branches/tags remain available. The legacy Vite/IndexedDB demo is archived in its existing branch and tags, not merged back over the newer mobile/Supabase implementation. No push, hosted migration, feature-flag activation or Play release is implied by local consolidation.

## Workflow 01 implementation

The current registration, dual-verification design, approval dependencies, regression checks and deployment limits are recorded in [Customer authentication](docs/workflows/WORKFLOW_01_CUSTOMER_AUTH.md). Registration submission is gated while the independent link-and-code verification service is prepared. The previous single-email-confirmation flow is insufficient for that new requirement.
