# Photo try-on options — 16 November 2026

Target experience: choose a person photo, a shirt and trousers, press Generate,
and receive one outfit image. The current service already supports that request
shape and runs FASHN bottom-first, then top. Reliability of preserving both
garments remains experimental. No model migration was made during this review.

## What the linked Spaces provide

- [WeShopAI Space code](https://huggingface.co/spaces/WeShopAI/WeShopAI-Virtual-Try-On/blob/main/app.py)
  submits jobs to remote endpoints using configured credentials and request
  signatures. The public UI code is not a local inference implementation or
  a release of the try-on weights. Its [official pricing](https://www.weshop.ai/member)
  lists a limited free trial without API access.
- [Kolors Space code](https://huggingface.co/spaces/Kwai-Kolors/Kolors-Virtual-Try-On/blob/main/app.py)
  sends person and garment images to a remote backend configured through
  `tryon_url` and credentials. Copying this Space does not provide that backend
  or downloadable VTON weights. This conclusion concerns the linked Space,
  not every model published under the Kolors name.

The public code was inspected; no generations were submitted to either service.
The supplied screenshot is a useful appearance reference, but changes in pose
and framing are visible between input and output. It does not demonstrate
preservation of two independently selected garments.

## Options without a paid inference API

- **Existing local FASHN VTON 1.5:** keep as the baseline. Its published interface
  takes one garment per call and supports tops, bottoms and one-pieces. Running
  on the user's existing GPU avoids per-image API charges. Its model repository
  lists Apache-2.0 and separate third-party components:
  [official implementation](https://github.com/fashn-AI/fashn-vton-1.5).
- **CatVTON:** a possible noncommercial challenger. Its authors publish code and
  weights, report under 8 GB VRAM for 1024×768 inference, and list CC BY-NC-SA 4.0
  terms. That published resource figure is not a measurement on this machine,
  and no local comparison or installation was performed:
  [official implementation](https://github.com/Zheng-Chong/CatVTON).

Free software/local execution still uses the existing computer, storage and
electricity. The reviewed Spaces do not establish an unlimited free application
API or guarantee their appearance can be reproduced with a downloadable model.

## Compare before switching

Use the same full-body person inputs and the same shirt/trouser references for
each candidate. Include plain garments, prints/logos, long sleeves, shirts over
the waistband, and hands near the torso. Compare garment identity and colours,
preservation of the first garment after the second edit, face/body/background
changes, waist/hand artifacts, failures, warm/cold latency, and peak GPU memory.
Record a small fixed benchmark rather than selecting only attractive outputs.
Neither upscaling nor a cleaner interface establishes correct garment transfer.

Keep sequential generation if it preserves both items reliably enough in this
benchmark. Evaluate a released multi-garment model separately if it does not;
one final image does not require one inference call. Exact quality parity with
the hosted demos has not been established.
