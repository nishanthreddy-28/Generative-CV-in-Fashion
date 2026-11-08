# Deterministic recommendation generation — local checkpoint

Implemented on existing `main`, 2026-11-08. No hosted Supabase changes, remote migration application or feature-flag enablement. No external AI/ML call, model dependency, personal-image access or try-on work. Outfit, wardrobe, catalog, body and preference data/mutation contracts are preserved.

## HTTP contracts

Both routes require verified authentication, active account eligibility and current-user Data API access; no service-role fallback. SQL independently enforces ownership and account eligibility.

- `POST /recommendations`: `{occasion, preferences?, wardrobeOnly, limit?}`. Occasion is Everyday, Work, Evening, Weekend or Special occasion. Preferences are text up to 2,000 characters (default empty); wardrobeOnly is a required strict boolean; limit is a strict integer 1–10 (default 5). Unknown fields, client-selected owners/results, null/invalid values and NUL text are rejected. Returns 200 `{items: Recommendation[], nextCursor:null}`. No valid pair returns an honest empty array; the request is still recorded.
- `GET /recommendations?limit=10`: recent currently available results belonging to the caller; limit 1–50. Returns the same page envelope with null continuation. Examines only the latest 20 owned requests (at most 200 result records), then returns the requested number. It is a bounded recent-history endpoint, not complete-history pagination. New run IDs break equal-timestamp ties deterministically.

Each result includes `id`, `requestId`, `name`, `description`, `occasion`, ordered `items`, wardrobe-only legacy `garmentIds`, integer `score`, `reasons`, `engineVersion:"rules-v1"` and timezone-aware `generatedAt`. Each item contains `source`, `garmentId`, `name`, `category`, `color`. These are generated recommendation references/descriptions, not saved-outfit membership IDs or copied garment records. Catalog IDs are never put into wardrobe-only garmentIds. Score is a transparent heuristic sum, not a probability, fit assessment or learned prediction.

Response extension is explicit: the original 35-contract audit recorded Page<Outfit> without explanations; these routes retain that envelope/legacy fields and add typed pieces, score, reasons and run/version/time metadata for this task. GET history is a new explicitly requested contract. The historical API audit document is unchanged.

Errors: 401 invalid/missing authentication; 403 denied eligibility; 422 invalid request/query; 503 unavailable/malformed dependency. Sensitive upstream bodies are suppressed. Empty sources and insufficient category coverage produce empty results, never mock fallback data.

## Rules, actual inputs and bounds

Rules execute in a reviewed current-user database transaction. FastAPI validates API input and response; the SQL engine selects authorized source data, computes the result and persists history atomically. Clients have no RPC accepting precomputed recommendation results, so direct Data API access cannot invent engine output.

1. Select at most **40 newest relevant wardrobe garments** owned by the user and, unless wardrobeOnly, **40 newest active relevant catalog garments**. Ordering uses creation timestamp/UUID tie-breakers. Relevant categories are Tops, Bottoms, Dresses and Shoes. Outerwear/Accessories are not used by v1.
2. Generate ordered Tops+Bottoms or Dresses+Shoes pairs. At most 80 candidates imply at most 1,600 valid pairs (bounded join input is 80×80). Real source UUIDs and metadata are used. A wardrobe-only empty wardrobe does not silently use catalog garments. Mixed mode may return catalog-only pairs when eligible.
3. Award the following explicit bonuses. Per-result reasons show the actual awarded amounts; no unavailable colour/style fact is fabricated.

   - Valid supported category pair: +60.
   - Both colours are nonblank and either exactly equal after trim/case normalization or one is a recognized neutral: +10. Neutrals: black, white, grey, gray, beige, navy, cream, ivory, denim. No general colour-clash or colour-science model is claimed.
   - Matching style/request token in each garment's name, colour, brand or material: +5 per matching garment, maximum +10. Read the existing **profile.style** field and request preferences. Split into lowercase alphanumeric tokens, keep unique tokens of length 3–32 and the first 20 in lexical order; match literal substrings. No negation, hard exclusion, natural-language intent or semantic understanding is implemented. The UI instructs users to list positive preferences.
   - The same category pair appears in one of the latest 50 owned saved outfits for the same occasion (trimmed/case-insensitive): +5. Read actual saved outfit/item attributes, using currently accessible garments. Do not copy or mutate those outfits.
   - Everyday/Weekend with Tops+Bottoms, or Evening/Special occasion with Dresses+Shoes: +5. Work has no invented formality rule, but may receive the saved-occasion-pattern bonus.
   - Owned wardrobe pieces: +2 each, maximum +4.

4. Rank by score descending, then first source/UUID and second source/UUID, and retain the requested limit. Same authorized candidates, style, request and relevant saved-outfit patterns produce the same ordered compositions, scores, names and reasons. Each call deliberately creates **fresh history request/result UUIDs and timestamps**; those identity fields are not deterministic across runs.

Existing settings store units and notification choice, not fashion preferences; they do not imply taste or garment fit. Body measurements/appearance fields, personal photos, profile bio/location, notifications and measurement units are not used by these compatibility rules. Missing/empty style text is allowed and contributes no style-token bonus. No new fashion-preference schema is invented.

Candidate bounds are intentional: an older complementary piece outside the selected newest-40 window may not participate even though it exists. Unlimited recommendations, complete wardrobe optimization and diversity/capsule planning are not claimed.

## Database/history and security

Additive migration: `supabase/migrations/202611080007_recommendations.sql`.

- Owner/Auth-linked `recommendation_requests` records occasion, submitted preference text, scope, requested limit, engine version and generated time. `recommendation_results` references the parent with a composite `(request_id,owner_id)` FK and unique rank 1–10; contains score, reason array and validated two-item descriptive snapshots. Indexes support recent owner requests and owner/request/rank result retrieval.
- Both tables enable/force RLS; authenticated, anonymous and service roles have no base-table privileges. The existing non-owner/non-login/non-bypass executor gets SELECT/INSERT only. Owner/active policies and a trusted transactional generator prevent client-selected ownership/results. API wrappers are invoker functions; fixed-search-path private helpers/projections are not exposed as ordinary client capabilities. No elevated client or new administrative role.
- Item snapshots have structural/category/source/UUID/length validation rather than live garment foreign keys. This is a deliberate **history representation** choice: descriptions/reasons reflect generation-time inputs and must not block ordinary wardrobe deletion. It is not implementation of the earlier proposed normalized live recommendation-item relationships or a recommendation-to-saved conversion model. Before future schema/save work, review whether that separate normalized representation/provenance is needed; do not treat these snapshots as authoritative current garment state.
- Every POST response and history read revalidates current ownership/existence and active catalog state for every item. Results with deleted, inaccessible or inactive source garments are omitted, including for catalog administrators. Historical metadata is not silently refreshed when an accessible source garment is renamed; current garment detail navigation reads its current data. No source garment/image records are copied.
- The existing lifecycle share lock covers generation and history insertion. Source reads are statement snapshots; concurrent source changes after generation can make a result unavailable on the next read. No cross-request source-availability freeze is promised. Supabase JWT gateway/RLS behavior remains unverified on hosted infrastructure.
- Request text/history are personal user-owned data. Auth/parent cascade removes history records during trusted deletion; this does not complete account deletion or existing outfit/Storage cleanup. No automatic history expiry, per-user storage quota or request rate limit is implemented. Retention/purge duration and production throttling require review before release. Per-call work/result bounds do not cap lifetime history growth.

## Frontend

The existing recommendation screen requests real generation, displays garment names/categories/colours with source-correct navigation, rule scores and individual reasons, and loads/refreshes recent owned history. Includes form validation, busy/success/error states, honest empty results and insufficient-category guidance. Generated state is bound to the current account; the existing resource hook isolates history by account and aborts stale reads. No mock records or fabricated success state is introduced.

The old **Save outfit** button posted an unsupported recommendationId variant to `/outfits`. It is removed here rather than presenting a nonfunctional save. **Build an outfit** opens the existing builder; it does not claim to prefill or save a recommendation. Recommendation-to-saved conversion remains a separate unimplemented milestone. No existing outfit API was changed.

## Verification and remaining boundary

From repository root:

```sh
backend/.venv/bin/python -m pytest -q backend/tests --ignore=backend/tests/test_foundation_database.py --ignore=backend/tests/test_body_profile_database.py --ignore=backend/tests/test_wardrobe_database.py --ignore=backend/tests/test_catalog_database.py --ignore=backend/tests/test_outfits_database.py --ignore=backend/tests/test_outfit_editing_database.py --ignore=backend/tests/test_outfit_filtering_database.py --ignore=backend/tests/test_recommendations_database.py
backend/.venv/bin/python backend/tests/database/run_local.py
backend/.venv/bin/python -m compileall -q backend/app
```

From `mobile`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run export:android -- --output-dir /tmp/dd-recommendations-android`.

Local results: **330 backend API/security tests passed**, **261 disposable PostgreSQL tests passed**, **46 frontend tests passed**. Compilation, typecheck, lint and Android JavaScript export passed. Existing Starlette/Node/export environment warnings remain; no dependencies changed. Initial frontend typecheck caught a TypeScript intersection that lost recommendation-specific item fields; corrected with Omit before adding the explicit typed items. A frontend command initially invoked from repository root found no package.json; rerun from mobile passed. The sandboxed PostgreSQL attempt could not allocate shared memory; the authorized disposable runner passed.

Coverage includes empty sources, deterministic compositions, real wardrobe/catalog references, wardrobe-only and inactive filtering, profile/request preference bonuses, saved-occasion patterns, dress/shoes/palette rules, candidate/result bounds, history generation/retrieval/visibility, user/admin isolation, invalid inputs, eligibility, base grants/RLS/constraints, frontend typed responses/navigation/explanations and error handling. Prior foundation/body/wardrobe/catalog/outfit regressions remain in the runs.

External HTTP interception is test-only; database tests use real PostgreSQL with minimal local Auth/Storage test primitives and apply migrations only in a disposable Unix-socket cluster. No hosted migration, PostgREST/JWT/Storage acceptance, physical-device test or signed release is claimed. `DATABASE_FOUNDATION_ENABLED=false` remains required until separately approved hosted security/integration acceptance. History retention/quota/throttling and recommendation saving remain unresolved/deferred as stated above.
