# Mobile integration contract — 23 November 2026

The Expo app source is maintained separately. These clients are prepared for integration;
they do not establish that an APK has been built or that the cloud is deployed.

## Deployment selection

The existing `InferenceClient` uses the authenticated Gradio/Supabase deployment,
not the local FastAPI studio. Deploy `deployment/cloud/space.py` with
`PHASE3_LLM_PROVIDER=workers`, `PHASE3_WORKERS_MODEL=@cf/google/gemma-4-26b-a4b-it`,
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. Workers/Gemma is now the cloud entry point default.
All provider credentials stay on the backend. Each client call obtains a fresh
Supabase access token through the session callback. Apply the existing private
storage/RLS migration and perform an authenticated deployment smoke test first.

## Body analysis screen

1. Pick a standing front-facing full-body photo. Keep head/feet in frame, arms
   down slightly away from the torso, legs uncrossed, and use a plain background.
2. Ask for known height (80–250 cm). Read the image as an ArrayBuffer using the
   app's existing file adapter and upload with `WardrobeStore.upload` using a
   unique filename. Do not send a device `file://` URI as an object path.
3. Call `client.bodyAnalysis(privatePath, heightCm, signal)`. Show loading and
   allow cancellation. This runs CPU MediaPipe once on the backend; it requires
   no native MediaPipe module or browser CDN downloads in the APK.
4. Display the four estimates, height calibration and original values. Allow
   numeric edits and reset; require an explicit confirmation checkbox. Explain
   that waist front width is not circumference and height was entered.
5. Call `client.confirmBodyAnalysis({...reviewed, confirmed: true}, signal)`.
   The backend validates values, records edited fields, preserves saved style
   preferences/manual measurements, and updates height calibration. Replace local
   profile state with the returned profile. Estimation never saves implicitly.
6. Keep the photo for analysis separate from the try-on photo. Add an explicit
   reuse button. Numeric edits do not condition hosted try-on sizing.

```ts
const client = new InferenceClient(spaceUrl, async () => {
  const {data, error} = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in');
  return {access_token: data.session.access_token};
});
const estimates = await client.bodyAnalysis(privatePhotoPath, heightCm);
// Show editable review UI before this next call:
const savedProfile = await client.confirmBodyAnalysis({...reviewed, confirmed: true});
```

The current `WardrobeStore.saveProfile` writes a complete profile: include the
returned body_analysis when saving preferences; clear it if height changes.
Do not populate waist_cm/chest_cm/hips_cm from photo front widths.

## Outfit screen

Call `client.chat(message, null, conversationId, signal)` to follow the message's
requested count. Pass 1–5 only when the user explicitly selects a count. Keep the
returned conversation_id for follow-ups; use null for a new conversation. Show
status/message/warnings as well as outfits, including no_match, clarification
and unavailable states. Use item IDs for replacement and selected garments.
Different shoes/jackets alone are no longer counted as different main outfits.
The bounded shortlist can return fewer outfits than requested; surface its warning.

## Local development alternative

FastAPI exposes bearer-authenticated POST `/phase3/body-analysis/estimate`
(multipart file + reference_height_cm), PUT `/phase3/body-analysis` (reviewed
JSON with confirmed=true), GET/PUT `/phase3/profile` and POST `/phase3/chat`.
These are separate from the Gradio transport; do not append these paths to an
InferenceClient Space URL. Never expose the combined local studio publicly:
its legacy Phase 2 routes and /media mount are for development. Use the
authenticated Supabase cloud adapter for the mobile deployment.

## Release checks

Verify login expiry and foreign-user denial, original estimate review/edit/save,
profile refresh, rejected crops/seated photos, independent try-on selection,
multiple distinct outfits, another/replace constraints and provider failures.
Test on the phone's release build over HTTPS with the laptop shut down. A model
quality study and tape-measure validation are still required; software regression
tests do not establish aesthetic accuracy or anthropometric accuracy.
