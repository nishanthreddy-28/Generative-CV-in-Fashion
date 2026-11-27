"""
Taxonomy + prompt banks. This file is pure data - no imports beyond strings.
Tuning the tagger means editing ONLY this file.

Each category: (label, slot, [prompt variants])
Prompts are averaged into a single prototype embedding, which is more
robust than any single phrasing.
"""

SLOTS = ["top", "outer", "bottom", "full", "shoes"]

TAXONOMY = [
    # ---------------- TOPS ----------------
    ("T-Shirt", "top", [
        "a photo of a t-shirt",
        "a plain cotton tee shirt",
        "a short sleeve t-shirt",
        "a crew neck tee",
    ]),
    ("Shirt", "top", [
        "a photo of a button-up shirt",
        "a collared dress shirt with buttons",
        "an oxford shirt",
        "a flannel button down shirt",
    ]),
    ("Blouse", "top", [
        "a photo of a women's blouse",
        "a flowy feminine top",
        "a silk blouse",
    ]),
    ("Polo Shirt", "top", [
        "a photo of a polo shirt",
        "a collared knit polo with buttons at the neck",
    ]),
    ("Tank Top", "top", [
        "a photo of a tank top",
        "a sleeveless top",
        "a camisole",
        "a vest top with thin straps",
    ]),
    ("Sweater", "top", [
        "a photo of a knitted sweater",
        "a wool pullover jumper",
        "a turtleneck sweater",
        "a chunky knit sweater",
    ]),
    ("Hoodie", "top", [
        "a photo of a hoodie",
        "a hooded sweatshirt with a drawstring hood",
        "a pullover sweatshirt",
    ]),
    ("Cardigan", "top", [
        "a photo of a cardigan",
        "an open front knitted cardigan",
        "a button up knit cardigan",
    ]),

    # ---------------- OUTERWEAR ----------------
    ("Jacket", "outer", [
        "a photo of a casual jacket",
        "a denim jacket",
        "a bomber jacket",
        "a leather biker jacket",
        "a lightweight windbreaker",
    ]),
    ("Coat", "outer", [
        "a photo of a long coat",
        "a wool overcoat reaching below the hip",
        "a trench coat",
        "a padded puffer winter coat",
    ]),
    ("Blazer", "outer", [
        "a photo of a tailored blazer",
        "a formal suit jacket with lapels",
        "a structured sport coat",
    ]),

    # ---------------- BOTTOMS ----------------
    ("Jeans", "bottom", [
        "a photo of a pair of jeans",
        "blue denim jeans trousers",
        "full length denim pants",
    ]),
    ("Trousers", "bottom", [
        "a photo of a pair of trousers",
        "chino pants",
        "formal dress pants",
        "tailored slacks",
    ]),
    ("Shorts", "bottom", [
        "a photo of a pair of shorts",
        "short trousers ending above the knee with two legs",
        "denim cutoff shorts",
        "athletic gym shorts",
    ]),
    ("Skirt", "bottom", [
        "a photo of a skirt",
        "a single piece garment worn on the lower body with no separate legs",
        "a pleated midi skirt",
        "a denim mini skirt",
    ]),
    ("Leggings", "bottom", [
        "a photo of leggings",
        "tight stretchy yoga pants",
        "opaque tights worn as trousers",
    ]),
    ("Joggers", "bottom", [
        "a photo of joggers",
        "sweatpants with elastic cuffs",
        "track pants",
    ]),

    # ---------------- FULL BODY ----------------
    ("Dress", "full", [
        "a photo of a dress",
        "a one piece dress covering torso and legs",
        "a summer sundress",
        "a formal cocktail dress",
    ]),
    ("Jumpsuit", "full", [
        "a photo of a jumpsuit",
        "a one piece romper with trouser legs",
        "dungaree overalls",
    ]),

    # ---------------- SHOES ----------------
    ("Sneakers", "shoes", [
        "a photo of a pair of sneakers",
        "athletic trainers",
        "canvas running shoes",
    ]),
    ("Boots", "shoes", [
        "a photo of a pair of boots",
        "leather ankle boots",
        "tall winter boots",
    ]),
    ("Heels", "shoes", [
        "a photo of a pair of high heeled shoes",
        "stiletto heels",
        "women's pumps with a raised heel",
    ]),
    ("Flats", "shoes", [
        "a photo of a pair of flat shoes",
        "leather loafers",
        "ballet flats",
        "sandals",
    ]),
]

LABELS    = [t[0] for t in TAXONOMY]
CAT_SLOT  = {t[0]: t[1] for t in TAXONOMY}
CAT_BANKS = [t[2] for t in TAXONOMY]


# ---------------------------------------------------------------------------
# ATTRIBUTES - each group is an independent softmax over its own options
# ---------------------------------------------------------------------------

ATTRIBUTES = {
    "pattern": {
        "solid":     ["a solid single color garment",
                      "a plain garment with no pattern"],
        "striped":   ["a striped garment",
                      "a garment with horizontal or vertical stripes"],
        "checked":   ["a plaid checked garment",
                      "a garment with a check or tartan pattern"],
        "floral":    ["a floral print garment",
                      "a garment printed with flowers"],
        "graphic":   ["a garment with a large graphic print",
                      "a garment with a printed logo or slogan"],
        "patterned": ["a garment with an abstract geometric pattern",
                      "a garment with an all over print"],
    },
    "formality": {
        "casual":       ["casual everyday clothing",
                         "relaxed weekend streetwear"],
        "smart_casual": ["smart casual clothing",
                         "business casual office clothing"],
        "formal":       ["formal business attire",
                         "elegant evening formal wear"],
        "athletic":     ["athletic sportswear",
                         "gym and workout activewear"],
    },
    "season": {
        "warm": ["lightweight breathable summer clothing",
                 "thin hot weather clothing"],
        "mild": ["mid weight spring clothing",
                 "transitional autumn layer"],
        "cold": ["heavy insulated winter clothing",
                 "thick warm cold weather clothing"],
    },
    "fit": {
        "slim":      ["a slim fitted garment", "a tight tailored garment"],
        "regular":   ["a regular standard fit garment"],
        "oversized": ["an oversized baggy garment",
                      "a loose relaxed drapey garment"],
    },
}


# ---------------------------------------------------------------------------
# G2 - is-this-clothing gate
# ---------------------------------------------------------------------------

CLOTHING_PROMPTS = [
    "a photo of a piece of clothing",
    "a garment laid flat on a surface",
    "an item of clothing on a hanger",
    "a clothing product photo on a white background",
    "a pair of shoes",
    "a person wearing an outfit",
]

NOT_CLOTHING_PROMPTS = [
    "a close up photo of a human face",
    "a photo of an empty room interior",
    "a photo of a cat or a dog",
    "a screenshot of a computer screen",
    "a photo of food on a plate",
    "a landscape or outdoor scenery",
    "a photo of furniture",
    "a blurry unrecognisable photo",
    "a document or a page of text",
    "a photo of a car",
]


# ---------------------------------------------------------------------------
# COLOR ANCHORS - sRGB, matched in CIELAB
# ---------------------------------------------------------------------------

COLOR_ANCHORS = {
    "black":      (18, 18, 18),
    "charcoal":   (60, 60, 62),
    "grey":       (128, 128, 128),
    "light grey": (200, 200, 200),
    "white":      (245, 245, 245),
    "cream":      (245, 235, 210),
    "beige":      (215, 195, 165),
    "brown":      (110, 75, 50),
    "tan":        (180, 145, 105),
    "navy":       (25, 35, 75),
    "blue":       (40, 90, 200),
    "light blue": (140, 190, 230),
    "teal":       (40, 130, 130),
    "green":      (55, 140, 70),
    "olive":      (110, 115, 60),
    "yellow":     (240, 215, 70),
    "orange":     (235, 130, 45),
    "red":        (200, 35, 40),
    "burgundy":   (110, 25, 40),
    "pink":       (235, 140, 175),
    "purple":     (120, 70, 165),
}
