"""Central configuration. Every tunable threshold lives here."""

from pathlib import Path

# --- paths -----------------------------------------------------------------
BASE_DIR    = Path(__file__).resolve().parents[2]
STORAGE_DIR = BASE_DIR / "storage"
IMAGES_DIR  = STORAGE_DIR / "images"
DB_PATH     = STORAGE_DIR / "drapedrop.db"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# --- model -----------------------------------------------------------------
MODEL_NAME  = "hf-hub:Marqo/marqo-fashionSigLIP"
EMBED_DIM   = 768
DEVICE      = None            # None -> auto (cuda if available)

# --- G1: file validation ---------------------------------------------------
MAX_UPLOAD_BYTES = 15 * 1024 * 1024      # 15 MB
MAX_IMAGE_SIDE   = 1024                  # downscale longest side to this
MIN_IMAGE_SIDE   = 128                   # reject anything smaller
ALLOWED_FORMATS  = {"JPEG", "PNG", "WEBP", "HEIF", "HEIC", "MPO"}

# --- G2: is-this-clothing gate --------------------------------------------
# Fraction of probability mass that must land on clothing prompts.
CLOTHING_GATE_THRESH = 0.45

# --- G3: cutout sanity -----------------------------------------------------
CUTOUT_MIN_RATIO = 0.03    # below this, rembg ate the garment
CUTOUT_MAX_RATIO = 0.97    # above this, rembg removed nothing
ALPHA_THRESH     = 200     # pixel counts as foreground above this alpha

# --- G4: confidence routing ------------------------------------------------
MARGIN_THRESH     = 0.04   # top1 - top2 below this -> offer picker
CONFIDENCE_THRESH = 0.25   # top1 below this -> force user to pick

# --- G5: duplicate detection ----------------------------------------------
DUPLICATE_THRESH = 0.95    # cosine similarity

# --- output ----------------------------------------------------------------
THUMB_SIZE   = 400
COLOR_K      = 3
IMAGE_FORMAT = "WEBP"
IMAGE_QUALITY = 88
