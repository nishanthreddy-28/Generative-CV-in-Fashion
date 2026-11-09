# Customer app navigation checkpoint

2026-11-09. Customer-facing navigation replaces the previous public workflow-review hub. No hosted configuration or backend contract changed.

- Welcome, sign-in, signup and recovery entry screens are available while signed out. On sign-in, protected-route state selects the customer dashboard and removes guest screens from navigation history. Sign-out removes personal/admin screens from history. Session restoration displays a branded loading state before protected content mounts.
- Personal wardrobe, catalog, outfits, recommendation, try-on and account screens require a session at the root Expo Router Stack.Protected boundary. Catalog administration additionally requires the trusted backend-derived admin projection. A deleting account has access to deletion progress, not normal app screens. Public privacy and Auth callback/recovery routes remain available.
- Deleted /preview and removed workflow-review links from the welcome page, login, shared header, auth gate and not-found page. The old ?preview=1 query cannot unlock screens or change draft ownership. Legacy boolean props remain internal compatibility plumbing only and never enable an authentication bypass.
- The signed-in shell has Home, Wardrobe, Discover, Outfits and Account navigation, active destination states, safe-area insets, small-screen padding and no duplicate stack header. Detail routes keep their relevant destination selected. Server JWT/lifecycle/ownership/RLS checks remain authoritative; client route locks are not server authorization.
- The dashboard uses editorial imagery, real-count summary cells, first-garment empty state and action cards for outfit creation, discovery, saved ideas and try-on. Counts appear only from real backend responses. No fabricated garments, totals or recommendations were added.
- Google is hidden by default because the hosted provider was last observed disabled. EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true may expose the existing PKCE button only after real provider/callback acceptance. This UI availability flag grants no authentication or administrator authority. Email/password forms and privacy links remain visible.

Verification: 63 frontend tests include complete route access classification, restoration/guest/user/admin/deleting state boundaries, active destinations and rejection of the old preview bypass. The installed Expo Router's discovered root screen names were compared with the explicit inventory. Typecheck, lint, Android export and final web-bundle compilation are checked for this checkpoint. Visual browser acceptance remains unavailable because Work settings disable browser control; real signed-in hosted acceptance is not claimed.

The customer review website remains http://localhost:8081 and FastAPI http://localhost:8000. Keep both running and wait for user feedback on the revised experience. DATABASE_FOUNDATION_ENABLED remains false; real application persistence is still pending the separately approved hosted milestone. No ML, hosted writes or release acceptance was performed.

## Collection, form and status polish

The next local UI pass preserves the approved architecture and actual API payloads:

- Wardrobe/catalog/admin: responsive two-column garment cards (one column on narrow screens), category/name/brand/size/INR price hierarchy, distinct inactive state, private image requests, stable image frames and retry placeholders. Missing images/details remain absent instead of substituted products. Search can submit from the keyboard. Collection search/category/order/cursor drafts survive detail navigation within the same account; focus refresh reflects edits/deletions on return.
- Catalog detail: labeled garment attributes and an explicit absence state when additional fields were not supplied.
- Outfits: collapsible source/category/date/order filters reduce the initial form length; applying invalid filters keeps controls open. Existing cursor loading, owner state, API semantics and draft preservation remain intact. Cards display actual item counts/occasion. Piece selection includes authenticated thumbnails and selected-state labels.
- Recommendations/bookmarks: source-aware authenticated garment imagery, compatibility score wording, explanation hierarchy and existing save controls. No predicted sizing or ML confidence is claimed.
- Try-on: readable queued, cancelled, failed and expired-input states, optional reveal of private photos and honest unavailable-generation messaging. No output is fabricated. Job/consent history remains after image expiration.
- Shared forms: password show/hide controls, email/name/current/new-password autofill hints, disabled/busy handling, clearer upload placeholders, picker duplicate-click prevention and selected-photo privacy messaging. Body profile explicitly warns that changing units does not convert measurements.
- Shared feedback: layout skeletons, explicit retry actions, polite status announcements, stronger error/success boundaries, labeled destructive confirmations and busy modal-close protection. Editorial imagery is limited to existing branded assets; no fake collection images or counts.
- Authentication: existing editorial asset gives the welcome/signup forms a consistent fashion context. Google remains hidden while unverified; email Auth behavior is unchanged.

Local tests added for responsive column decisions, optional garment summaries, zero/invalid prices, try-on state presentation and password autofill classification. Current frontend suite: 67 tests. Typecheck/lint/Android export and runtime bundle evidence are recorded in the master checklist. Real-browser/device verification remains separate: browser control is disabled. Both review servers remain running, and hosted work is deferred at the user's request.

## Actual Chrome review — 2026-11-09

Browser access became available during the next personal-review gate. Earlier statements about unavailable browser control are historical; the following checks were actually performed in the existing Drape & Drop Chrome tab, without accessing unrelated sites or personal credentials.

- Desktop: observed welcome and sign-in pages. Found a real layout defect: a square image's intrinsic 1024px dimensions overrode its aspect-ratio style, making the sign-in illustration 1024px tall and hiding the form below the fold. A shared FramedImage now owns the aspect-ratio frame and explicitly constrains its absolutely positioned image to 100% width/height. Applied to welcome/Auth/dashboard and local photo previews; authenticated garment images use the same explicit bounds. This prevents both excessive height and blank mobile cropping.
- Mobile widths: visually inspected welcome at 320px and login/signup at 375px. Measured body scroll width matched viewport width (320/375); no horizontal page overflow in those states. Verified corrected image rendering rather than relying only on compile success. Full-image containment avoids cutting off the editorial subject. Temporary viewport override was reset afterward.
- Navigation and forms: clicked Get started, signup, back-to-login, password visibility, recovery and privacy links. Blank login, signup and recovery submissions showed required-field errors. No signup/login/recovery network submission with credentials was performed. Missing confirmation, recovery and OAuth callback parameters showed their respective unavailable states.
- Route locks: actually navigated to /dashboard, /wardrobe?preview=1, /admin?preview=1, /outfits, /recommendations, /try-on and /account-deletion while signed out. All seven redirected to /login. No protected screen was unlocked or supplied mock records for visual inspection.
- Console: no error-level entries were captured for the inspected app tab. Warning capture included EventEmitter/ObjectMultiplex messages whose origin was not established; do not claim all warnings absent or attribute them to application code without evidence.
- Screenshots saved outside the repository under the session visualization directory (ui-review/mobile-login.jpg and ui-review/desktop-login.jpg). The Chrome tab is left on login for the user's review; both local servers remain running.

Remaining acceptance: no signed-in dashboard/collection/admin visual inspection, hosted data persistence, real email delivery, Google callback, native device or installed build test was performed. Those require actual authorized accounts/configuration and the next approval stages. This review does not approve hosted writes or feature-flag enablement. Wait for the user's personal UI approval before continuing to hosted/Android/final acceptance.

## Mobile campaign landing — 2026-11-09

Added a burgundy/ivory fashion campaign with three generated editorial assets showing fictional adult models. H&M, Zara and Mango were used as visual references for editorial navigation and composition. The original assets are decorative brand imagery, not catalog records or try-on outputs. Optimized JPEG files total approximately 1 MiB and are bundled locally. The landing includes section navigation, product explanation, a style edit, account links and expandable questions. The original checkpoint added a desktop split hero; the phone-only follow-up below replaces that behavior.

Chrome local review covered 320, 375, 390, 430, 768 and 1280 CSS pixels. No document horizontal overflow was detected and all rendered images loaded. Section links, FAQ expansion, email/password page navigation and the paused privacy URL's return to home were exercised. Public privacy links were removed at the owner's request. The existing privacy route is temporarily redirected to home. Existing signed-in account controls and backend security continue to follow their access rules.

The owner chose a real test account after hosted setup approval. No review credentials or sample customer records were created. That account and real persistence acceptance remain dependent on the reviewed migration, independent verification, Auth callbacks and security gates. The local campaign review does not establish those hosted workflows.

## Phone-only browser shell — 2026-11-09

All browser routes now share a centered frame capped at 480 CSS pixels, with a neutral surrounding background. Narrow browsers use their full width. The landing keeps its stacked mobile composition at every browser width, and shared confirmation overlays use the same width boundary. Native screens keep their normal device width. Authentication guards and API contracts are unchanged.

Chrome verified the local landing frame at 480px within a 1280px browser and the sign-in form at both 1280px and 320px browser widths, without document horizontal overflow. Signed-in screens remain unverified because this checkpoint does not bypass authentication. Frontend tests: 71 passed; typecheck, lint and the review-mode production web build passed. Hosted activation and real test-account acceptance remain pending.
