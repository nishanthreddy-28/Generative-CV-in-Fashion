# Code map

Paths below are relative to `backend/`. Start with the feature, then follow its
contracts and route into the implementation. Tests keep expensive model/network
dependencies simulated unless a script explicitly says it uses real inference.

| Feature | Main implementation | Relevant tests |
|---|---|---|
| Combined development server | `app/main.py`, `app/api/wardrobe_app.py` | `tests/test_studio.py` |
| Garment upload, correction, deletion | `app/api/items.py`, `app/persistence/wardrobe.py` | `test_studio.py`, `test_recommendations_api.py` |
| Image checks, cutouts, tagging | `app/wardrobe/pipeline.py`, `gates.py`, `background.py`, `tagger.py` | `test_preparation_performance.py` |
| Categories, prompts and colours | `app/wardrobe/taxonomy.py`, `color.py` | Classification tool in `eval/run_eval.py` |
| Body-photo validation | `app/pose/validation.py` | `test_photo_validation.py` |
| Body estimates/review contracts | `app/pose/measurements.py`, `models.py` | `test_pose_mobile.py`, `test_chat_body_fallback.py` |
| Saved taste/body profile | `app/profiles/service.py`, `fit.py` | `test_profile.py`, `test_pose_mobile.py` |
| Outfit search and ranking | `app/recommendations/search.py`, `scorer.py`, `service.py` | `test_recommendation_search.py`, `test_recommendations_api.py` |
| Chat interpretation/assessment | `app/chat/stylist.py`, `alternate_providers.py`, `routing.py` | `test_stylist_constraints.py`, `test_alternate_stylists.py` |
| Request caching/quota safeguards | `app/chat/request_budget.py` | `test_gemini_budget.py` |
| Try-on jobs and preparation | `app/tryon/jobs.py`, `preparation.py` | `test_tryon.py`, `test_tryon_preparation.py`, `test_preview_flow.py` |
| WeShopAI + IDM-VTON fallback | `app/tryon/hosted.py`, `weshop.py`, `idm.py`, `common.py` | `test_weshop_tryon.py`, `test_idm_tryon.py`, `test_provider_selection.py` |
| Conversation/profile SQLite | `app/persistence/conversations.py` | `test_recommendations_api.py`, `test_profile.py` |
| Authenticated cloud behavior | `app/cloud/service.py`, `deployment/cloud/space.py` | `test_cloud_contract.py`, `test_cloud_engine.py` |
| Mobile clients | `deployment/mobile/inference.ts`, `wardrobe.ts` | `scripts/verify_mobile_client.mjs` |
| Browser test interface | `web/studio/` | `test_studio.py`, `scripts/verify_body_pose_browser.py` |

## Shared boundaries

- `app/core/config.py`: model choice, paths, thresholds and image limits.
- `app/core/mask_cache.py`: reusable segmentation cache.
- `app/contracts/wardrobe.py`: wardrobe item and classification contracts.
- `app/contracts/styling.py`: intent, chat, assessment and recommendation contracts.
- `app/api/styling.py`: styling HTTP endpoints and authenticated user resolution.

## Operational scripts

| Command in `scripts/` | Purpose |
|---|---|
| `start_studio.ps1` | Local server launcher used by root `start.ps1` |
| `setup_models.py` | Download/check pretrained recommendation assets |
| `setup_pose_validation.py` | Download MediaPipe pose asset |
| `prepare_tryon_background.py` | CPU background stage for a preview job |
| `prepare_tryon_garments.py` | CPU human-parser garment isolation |
| `build_space_bundle.py` | Build a source-only cloud upload directory |
| `verify_layout.py` | Check retained local data and archived weights |
| `verify_recommendation_model.py` | Real-model scoring smoke check |
| `verify_recommendations_e2e.py` | Isolated real-model recommendation replay |
| `verify_chat.py`, `verify_gemini.py` | Explicit model/provider smoke checks |
| `compare_stylists.py`, `.ps1` | Explicit stylist-provider experiments |

## What not to edit for feature work

`storage/` is generated/private runtime state, not source. `research/` and
`docs/history/` preserve experiments, not current implementations. The sibling
FASHN archive is outside the active stack. Use `STRUCTURE_MIGRATION.json` to find
the new location of a module mentioned in an older chat/report.
