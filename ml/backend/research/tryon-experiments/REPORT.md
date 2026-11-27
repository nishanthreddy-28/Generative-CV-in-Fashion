# Hugging Face photo try-on review

Checked: 16 November 2026, Asia/Calcutta.

Recommendation: **FitDiT is the first hosted candidate I would evaluate for this
free, noncommercial prototype.** It produced a convincing patterned top and a
subsequent skirt edit through its public API during this review. This is an
integration recommendation, not a finding that it beats every model in image
quality. The requested top-and-trousers flow has NOT passed a reliable end-to-end
test: the jeans stage returned an uninformative error on two attempts.

No models were installed or executed locally. No personal photos, account
tokens, paid API keys or billing accounts were used. Network probes used only
published FitDiT example images. Public-sample files and generated outputs are
kept here for inspection, not presented as a new licensed evaluation dataset.

## Scope and evidence

- Searched Hugging Face Space/model metadata and published papers/model cards.
- Recorded live runtime and named API schemas for 22 Spaces in
  [live_api_checks.json](live_api_checks.json). A running flag or schema is not
  proof that generation works or that app integration is supported by the owner.
- Inspected primary implementation code for input support and API restrictions.
- Attempted actual API calls for FitDiT, Leffa, Qwen outfit swap and FASHN.
  These are functional probes, not a controlled multi-model quality benchmark.
- The successful FitDiT example starts with a man wearing a grey T-shirt and
  beige shorts. The first reference is a patterned sleeveless knitted top with
  a large star/logo. The successful second reference is a floral skirt.

## Shortlist

| Candidate | Evidence and relevance | Main limit |
| --- | --- | --- |
| [FitDiT](https://huggingface.co/spaces/BoyuanJiang/FitDiT) | Public `/generate_mask` and `/process` endpoints. Accepts the user's person photo and upper/lower/dress references. Current source offers resolutions through 1536×2048. Actual top generation and top→skirt sequence succeeded. | One garment per generation. Jeans calls failed. Noncommercial model terms. |
| [Leffa](https://huggingface.co/spaces/franciszzj/Leffa) | Open implementation focused on garment-detail correspondence, with VITON-HD tops and a DressCode variant for upper/lower/dresses. Public `/leffa_predict_vt` schema is available. Model card lists MIT. | My generation probe failed with a null error. DressCode is labeled experimental in the demo. No successful output was obtained for comparison. |
| [Qwen-Image-2.1 Outfit Swap](https://huggingface.co/spaces/hugging-apps/qwen-image-outfit-swap) | Running ZeroGPU Space with `/swap`. Source accepts person + outfit-reference image and a text instruction; it can edit a full outfit in one call. | My call was rejected by ZeroGPU quota. Separate top and trouser images are not separate input fields; a garment-board adaptation would require evaluation. No quality result was obtained. |
| [FASHN VTON 1.5](https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5) | Running Space with a public `/try_on` endpoint supporting tops, bottoms and one-pieces. Relevant existing project baseline. | My hosted bottom-generation probe failed with a null error. Sequential full-outfit fidelity remains to be evaluated. |
| [FLUX Klein 9B Try-On LoRA](https://huggingface.co/fal/flux-klein-9b-virtual-tryon-lora) | Explicit person + top + bottom input format is an excellent match for the requested feature. | A model/adapter release and paid-hosting example do not establish an existing free hosted API. The card says its example images were generated with Nano Banana Pro; do not use them as measured LoRA performance. |

The Leffa description comes from its [official model card](https://huggingface.co/franciszzj/Leffa)
and [demo implementation](https://huggingface.co/spaces/franciszzj/Leffa/blob/main/app.py).
FitDiT input categories/resolutions come from its
[demo implementation](https://huggingface.co/spaces/BoyuanJiang/FitDiT/blob/main/app.py).
These author descriptions and configurations do not establish superiority on
Drape&Drop wardrobe photos.

## Other candidates and why they do not lead this recommendation

- **Kolors:** attractive demo, but the current
  [source](https://huggingface.co/spaces/Kwai-Kolors/Kolors-Virtual-Try-On/blob/main/app.py)
  disables its named generation API (`api_name=False`); the live named endpoint
  map was empty. I did not attempt to bypass this restriction.
- **WeShopAI:** its schema advertises a generation endpoint, but the
  [source](https://huggingface.co/spaces/WeShopAI/WeShopAI-Virtual-Try-On/blob/main/app.py)
  hides API access and calls a credentialed remote backend. Its
  [commercial free trial](https://www.weshop.ai/member) excludes API access.
  That is distinct from the Space's demo policy; ongoing free app integration
  was not established. No generation was submitted to it.
- **OutfitAnyone:** its
  [public demo](https://huggingface.co/spaces/HumanAIGC/OutfitAnyone/blob/main/app.py)
  has separate top/bottom inputs, but fixes the people to preset models and
  explicitly disallows uploading a person photo. That fails the core use case.
- **Miragic:** named API schema exists, but important logic is obfuscated and
  ongoing free integration conditions were not verified. Its UI promotes a
  separate account for unlimited generations. No quality probe was run.
- **CatVTON, OmniTry, the checked Qwen try-on LoRA demos:** runtime/configuration
  failures at the time of the checks. They may become usable after repair.
- **DreamO:** a running general customization demo with two reference inputs.
  Its multi-condition capability is interesting, but I did not establish a
  direct, faithful person + separate top + separate trouser workflow.
- **OOTDiffusion/IDM-VTON:** running public API schemas; useful comparison
  baselines, but no new quality probes were completed in this review.
- **LookSwap:** running UI, empty named API map at the time of inspection.
- **Oxygen-TryOn/WearWow/MuGa-VTON research:** relevant multi-item claims exist,
  but no usable official free hosted API was verified in this search.

## Actual API probes

| Probe | Result |
| --- | --- |
| FitDiT, knitted top on public person image | Completed in 15.96 s including upload, mask and generation; 768×1024, 20 steps, guidance 2, seed 42. |
| FitDiT, floral skirt on the top result | Completed in 18.66 s for the second stage. Both references remained recognizable in the final image. |
| FitDiT, jeans on the top result | Failed at generation with a null error; one bounded retry also failed. The reason was not exposed. |
| Leffa, same top/person reference pair | Null error; generation completion not verified. |
| Qwen outfit swap | ZeroGPU quota exceeded; response requested authentication for more quota. |
| FASHN, jeans on original person | Null error; generation completion not verified. |

An earlier remote-URL input attempt produced missing-file errors. Subsequent
probes used the documented Gradio upload mechanism. The table above describes
those upload-based probes. Failures do not distinguish model quality from
hosting/runtime/quota problems.

Inspection of the successful FitDiT outputs: the knitted texture, star and logo
remain recognizable, and the top is largely retained in the skirt edit. Fine
details change, including some fabric pattern details and facial/hand appearance.
This is visual evidence from one person and two references, not a measured
identity-preservation or garment-fidelity score.

Files:

- [Original person](person.jpg)
- [Knitted top reference](shirt.jpg)
- [Top preview](shirt_result.webp)
- [Floral skirt reference](skirt.jpg)
- [Successful top + skirt preview](skirt_result.webp)
- [Jeans reference used in the failed attempt](trousers.jpg)
- Per-candidate `*_api_smoke.json` files record results and errors.

## Free hosting and next decision

Hugging Face says existing ZeroGPU Spaces are free to use with daily quotas and
queues. Its current documentation also permits eligible free personal accounts
to host up to two ZeroGPU Spaces. Eligibility and operational compatibility must
be checked on the actual account; public demo access does not grant unlimited
capacity. [Official ZeroGPU documentation](https://huggingface.co/docs/hub/en/spaces-zerogpu)

FitDiT's [model card](https://huggingface.co/BoyuanJiang/FitDiT) explicitly lists
noncommercial terms and directs commercial users to Tencent Cloud. This makes
it a candidate for a noncommercial prototype, not an automatically cleared
commercial deployment.

For the current prototype: evaluate FitDiT first and keep Leffa/FASHN as
challengers. Before changing Drape&Drop's provider, require repeated successful
top-and-trouser API runs on a fixed set of person and garment images, including
waist/hand occlusion. A two-call implementation can still return one final image.
This review does not establish a reliable, unlimited-free service or a universal
image-quality winner. No application provider was changed.
