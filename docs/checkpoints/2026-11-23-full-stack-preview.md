# Full-stack preview checkpoint — 2026-11-23

This checkpoint preserves the complete current project work on main. It is a local implementation preview, not production acceptance.

## Included work

- Direct Supabase authentication candidate and frontend binding, preserving existing legacy coordinator source.
- Private optional onboarding, review and body-photo persistence.
- Personalization, deterministic recommendation preferences and structured feedback.
- Wardrobe duplicate-photo warning and private multi-photo gallery.
- Atomic outfit duplication.
- Backend-only frontend data handling, worker updates, tests and architecture/API documentation.
- Existing generated research/design PDFs and text in output/pdf, retained for later user-directed organization.

## Verification

- Backend suite: 442 passed, 364 skipped outside the dedicated database runner.
- Dedicated disposable PostgreSQL run: 308 existing tests plus 56 extended tests passed before checkpoint preparation.
- Frontend: 85 tests, typecheck, lint and web review build passed.
- Fixed gallery array-response validation during checkpoint review, then reran frontend checks.
- Secret-pattern review found only synthetic fixtures; private environment files and build outputs remain excluded.
- An initial backend test invocation from the repository root failed import collection; rerunning from the documented backend directory passed.

## Hosted and release boundaries

Hosted history was inspected in Supabase and ends at 202611090010. The six 20261123 migrations remain local candidates. Hosted signup is disabled; existing authentication can succeed while account eligibility denies access. A verified recovery backup and controlled rollout are required before these features are available against hosted Supabase. The local review process enables the existing user-scoped adapter only; checked-in defaults remain disabled.

All ten workflows are not complete. See docs/workflows/SADD_IMPLEMENTATION_TRACKER.md for implementation gaps. ML remains deferred. No Supabase changes are part of this Git checkpoint. A push to main can trigger existing GitHub deployment integrations; it does not apply database migrations.

Legacy feature branch tips will be retained in archive tags before branch cleanup. No user-directed repository reorganization or file removal is performed here. Previously deleted frontend coordinator files are preserved as intentional direct-auth replacement changes and remain recoverable in Git history.
