# Generative-CV-in-Fashion

# AI Virtual Try-On Platform



A generative AI-powered fashion intelligence and virtual try-on platform that analyzes user appearance, understands clothing styles, and generates realistic personalized outfit visualizations before purchase.



---



# Overview



Online and in-store fashion shopping often lacks personalization. Users are unable to accurately visualize how clothing items will look on their own body type, skin tone, and proportions before making a purchase.



Traditional recommendation systems focus only on product popularity or generic styling trends, without considering individual physical attributes or visual compatibility.



Therefore, an AI-powered personalized fashion platform is needed to:

- understand user appearance and preferences

- analyze clothing items intelligently

- recommend suitable outfits

- simulate realistic virtual try-on previews before purchase



---



# Key Features



- **Body & Skin Analysis:** Detects body proportions, pose, body type, skin tone, and undertones from uploaded user images.



- **Smart Outfit Recommendation:** Recommends personalized outfits based on wardrobe analysis, body structure, skin tone, occasion, and style preferences.



- **External Clothing Input:** Supports clothing image uploads or product links from platforms such as H&M, Zara, and Nike.



- **Garment Segmentation:** Extracts clothing items from images while isolating background noise and models.



- **Avatar Generation:** Builds a body-aligned personalized avatar using uploaded user photos.



- **Virtual Try-On Engine:** Generates realistic try-on previews while preserving clothing texture, folds, patterns, and logos.



- **Compatibility Scoring:** Evaluates outfit suitability based on color harmony, style consistency, and user profile.



- **Style Suggestions:** Suggests complementary clothing combinations and accessories.



---



# System Workflow



```text

User Uploads

├── Selfie / Full-body photo

├── Wardrobe images

└── External clothing image OR product URL



          ↓



AI Vision Pipeline

├── Body analysis & pose estimation

├── Clothing segmentation

└── Skin tone detection



          ↓



Garment Extraction

├── Isolate shirt / jacket / pants from background

└── Identify texture, fabric, colors, design



          ↓



Avatar Generation

└── Body-aligned 2D avatar from user photo



          ↓



Virtual Try-On Engine

├── Warp garment onto avatar

├── Preserve folds, design, logos

└── Simulate appearance



          ↓



Output

├── Front view preview

├── Side view preview

├── Compatibility score

└── Style suggestions

```



---



# Tech Stack



| Layer | Technology |

|---|---|

| Body & Pose Analysis | MediaPipe, OpenPose |

| Skin Tone Detection | OpenCV, color clustering |

| Clothing Segmentation | SAM (Segment Anything Model) |

| Fashion Parsing | Pre-trained fashion segmentation models |

| Virtual Try-On | IDM-VTON / OOTDiffusion |

| Avatar Generation | 2D body-aligned warping pipeline |

| Backend | Python, FastAPI |

| Frontend | React.js |

| Model Serving | HuggingFace Spaces APIs |



---



# AI Models Used



| Model | Purpose |

|---|---|

| MediaPipe Pose | Body keypoint detection and pose estimation |

| SAM (Segment Anything) | Garment segmentation |

| IDM-VTON | 2D virtual try-on synthesis |

| OOTDiffusion | Diffusion-based try-on |

| CatVTON | Lightweight virtual try-on option |



# Future Scope



- 3D avatar generation and rotating previews

- Real-time AR-based virtual try-on

- Multi-garment outfit simulation

- AI-powered size recommendation

- Brand-integrated shopping assistant

- Personalized fashion analytics

- Seasonal outfit intelligence



---



# License



This project is licensed under the MIT License.
