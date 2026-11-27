import hashlib
import itertools
import math

from pydantic import ValidationError

from app.persistence import wardrobe as db
from app.contracts.styling import Intent
from app.contracts.styling import Outfit
from app.contracts.styling import RecommendationResponse
from app.recommendations.scorer import ModelUnavailable
from app.chat.stylist import LLMUnavailable
from app.profiles.service import Profile
from app.profiles.service import affinity
from app.profiles.service import contextual_intent
from app.profiles.service import bounded_context
from app.recommendations.search import diverse
from app.recommendations.search import retrieve_pool
from app.recommendations.search import EXACT_POOL_LIMIT
from app.contracts.wardrobe import Item

MAX_COMBINATIONS = 20000
MAX_WARDROBE = 200
SHORTLIST = 6


def outfit_id(items):
    return hashlib.sha256("|".join(sorted(i["id"] for i in items)).encode()).hexdigest()[:20]


def clothing_core(items):
    return frozenset(item["id"] for item in items if item["slot"] in {"top", "bottom", "full"})


def generate(items, intent, previous=(), retriever=None, preference=lambda _: 0, previous_core=(), allow_without_shoes=False):
    ids = {item["id"] for item in items}
    if not (set(intent.required_ids) | set(intent.excluded_ids)) <= ids:
        return [], "An item reference is unavailable in this wardrobe."
    available = [i for i in items if i["id"] not in intent.excluded_ids]
    category_slots = {}
    for category in intent.required_categories:
        matches = [item for item in available if item["category"] == category]
        if not matches:
            return [], f"No available {category} items match this request."
        for item in matches:
            category_slots.setdefault(item["slot"], set()).add(category)
    available = [item for item in available if item["slot"] not in category_slots
                 or item["category"] in category_slots[item["slot"]]]
    if not set(intent.required_ids) <= {item["id"] for item in available}:
        return [], "A selected garment conflicts with the requested clothing category. Please choose which to keep."
    slots = {slot: sorted([i for i in available if i["slot"] == slot], key=lambda item: item["id"])
             for slot in ("top", "bottom", "full", "shoes", "outer")}
    if any(sum(i["slot"] == slot for i in available if i["id"] in intent.required_ids) > 1 for slot in slots):
        return [], "The selected garments occupy the same supported outfit slot."
    if intent.outerwear == "excluded" and any(i["slot"] == "outer" and i["id"] in intent.required_ids for i in available):
        return [], "An outer layer is required by item selection but excluded by the request."
    outers = ([None] if intent.outerwear == "excluded" else
              slots["outer"] if intent.outerwear == "required" else [None] + slots["outer"])
    required = set(intent.required_ids)
    locked_slots = {i["slot"] for i in available if i["id"] in required} | set(category_slots)
    if "full" in locked_slots and locked_slots & {"top", "bottom"}:
        return [], "Please choose either a full garment or separate top and bottom for this supported outfit template."
    # Restrict locked slots before enumerating, preserving all valid templates.
    for slot, options in slots.items():
        locked = [i for i in options if i["id"] in required]
        if locked:
            slots[slot] = locked
    if "outer" in category_slots and intent.outerwear == "excluded":
        return [], "The requested clothing category requires an outer layer, but outerwear is excluded."
    if "outer" in category_slots or any(i["slot"] == "outer" and i["id"] in required for i in available):
        outers = slots["outer"]
    separate_count = 0 if "full" in locked_slots else len(slots["top"]) * len(slots["bottom"])
    full_count = 0 if locked_slots & {"top", "bottom"} else len(slots["full"])
    footwear = slots["shoes"] or ([None] if allow_without_shoes else [])
    count = (separate_count + full_count) * len(footwear) * len(outers)
    previous = set(previous)
    previous_core = frozenset(previous_core)
    def is_seen(candidate):
        return outfit_id(candidate) in previous or bool(previous_core and clothing_core(candidate) == previous_core)
    if count > EXACT_POOL_LIMIT and retriever is not None and slots["shoes"]:
        return retrieve_pool(slots, outers, required, retriever,
                             is_seen=is_seen,
                             preference=preference), None
    if count > MAX_COMBINATIONS:
        return [], "This wardrobe has too many combinations. Select a garment to build around."
    result = []
    bases = itertools.chain(itertools.product(slots["top"], slots["bottom"], footwear) if separate_count else (),
                            itertools.product(slots["full"], footwear) if full_count else ())
    for base in bases:
        for outer in outers:
            outfit = [item for item in base if item is not None] + ([outer] if outer is not None else [])
            if len(outfit) >= 2 and required <= {i["id"] for i in outfit} and not is_seen(outfit):
                result.append(outfit)
    return result, None


def recommend(items, intent, scorer, stylist, previous=(), profile=None, feedback=None, fit_notes=None, last_ids=(), allow_without_shoes=False):
    profile = profile or Profile()
    feedback = feedback or {}
    fit_notes = fit_notes or {}
    def preference(candidate):
        # A soft penalty avoids repeating identical outfits across requests while
        # allowing a previously shown outfit when it is the only suitable option.
        repetition = 0.08 if outfit_id(candidate) in previous else 0
        return affinity(candidate, profile) + feedback.get(outfit_id(candidate), 0) - repetition
    def response(status, message, **kwargs):
        return RecommendationResponse(status=status, message=message, intent=intent, **kwargs)
    if len(items) > MAX_WARDROBE:
        return response("needs_clarification", "Please narrow the wardrobe to at most 200 active garments.")
    try:
        for item in items:
            Item.model_validate(db.row_to_item(item))
    except (ValidationError, ValueError, KeyError, TypeError):
        return response("needs_clarification", "Some wardrobe metadata is incomplete or invalid. Correct those garments before requesting outfits.")
    try:
        retriever = scorer if callable(getattr(scorer, "retrieve_scores", None)) else None
        previous_core = clothing_core([item for item in items if item["id"] in last_ids]) if intent.another else ()
        candidates, issue = generate(items, intent, previous if intent.another else (), retriever, preference, previous_core, allow_without_shoes=allow_without_shoes)
    except (ModelUnavailable, OSError) as exc:
        return response("unavailable", str(exc) if isinstance(exc, ModelUnavailable) else "A required wardrobe image could not be read.")
    if issue:
        return response("needs_clarification", issue)
    if not candidates:
        if intent.another and previous_core:
            return response("no_match", "I couldn't find another outfit with a different top, bottom or full garment under your current selections. Changing only a jacket or shoes would repeat the same main clothing. Try releasing a selected piece or adding another garment.")
        qualifier = "another complete outfit" if intent.another else "a complete outfit"
        return response("no_match", f"I couldn't construct {qualifier} from the available items and your selections. A top and bottom (or a full garment), and shoes are needed.")
    try:
        scores = scorer.score(candidates)
        if len(scores) != len(candidates) or not all(math.isfinite(s) for s in scores):
            raise ModelUnavailable("Invalid number of ranking scores")
        ranked = sorted(zip(candidates, scores), key=lambda pair: (-(pair[1] + preference(pair[0])), outfit_id(pair[0])))
        # Spend the first visual calls on different main clothing, rather than
        # allowing accessory/layer variants to crowd out alternative bases.
        first, variants, cores = [], [], set()
        for pair in ranked:
            core = clothing_core(pair[0])
            (variants if core in cores else first).append(pair)
            cores.add(core)
        shortlist = diverse(first, SHORTLIST, intent.required_ids, preference)
        if len(shortlist) < SHORTLIST:
            shortlist += diverse(variants, SHORTLIST-len(shortlist), intent.required_ids, preference)
        assessed = {}
        def unique_suitable():
            return {clothing_core(candidate) for candidate, _ in shortlist
                    if outfit_id(candidate) in assessed and assessed[outfit_id(candidate)].decision == 'suitable'}
        # Gemini handles the bounded shortlist in one request. Local models
        # retain small image batches to fit their context and memory limits.
        batch_size = max(1, min(SHORTLIST, getattr(stylist, "assessment_batch_size", 2)))
        if getattr(stylist, "assessment_batch_matches_count", False):
            batch_size = min(batch_size, intent.count)
        for start in range(0, len(shortlist), batch_size):
            batch = shortlist[start:start + batch_size]
            context = contextual_intent(intent, profile)
            measured = {item["id"]: fit_notes[item["id"]] for candidate, _ in batch for item in candidate if item["id"] in fit_notes}
            if measured:
                import json
                context = context.model_copy(update={"preferences": bounded_context(context.preferences + ["User-entered circumference comparisons by item ID (do not certify fit): " + json.dumps(measured)])})
            assessed.update(stylist.assess(context, [(outfit_id(c), c) for c, _ in batch]))
            if len(unique_suitable()) >= intent.count:
                break
        suitable = [(candidate, score) for candidate, score in shortlist
                    if outfit_id(candidate) in assessed and assessed[outfit_id(candidate)].decision == "suitable"]
        accepted = []
        accepted_cores = set()
        # Recompute diversity after unsuitable candidates have been removed.
        for candidate, score in diverse(suitable, len(suitable), intent.required_ids, preference):
            core = clothing_core(candidate)
            if core in accepted_cores:
                continue
            assessment = assessed.get(outfit_id(candidate))
            if assessment is None:
                continue
            if assessment.decision == "suitable":
                output_items = []
                for item in candidate:
                    value = db.row_to_item(item)
                    value["image_url"] = f"/phase3/items/{item['id']}/image"
                    value["thumb_url"] = value["image_url"] + "?thumbnail=true"
                    output_items.append(value)
                accepted.append(Outfit(id=outfit_id(candidate), items=output_items,
                                       ranking_score=float(score), explanation=assessment.reason,
                                       fit_notes=[f"{item['category']}: {note}" for item in candidate for note in fit_notes.get(item["id"], [])]))
                accepted_cores.add(core)
                if len(accepted) >= intent.count:
                    break
        if not accepted:
            if any(a.decision == "unknown" for a in assessed.values()):
                return response("needs_clarification", "I couldn't establish suitability from the available photos and details. Please clarify the dress code or garment properties that matter.")
            return response("no_match", "I couldn't find a suitable outfit among the combinations I checked for this request.",
                            warnings=["Only the top diverse shortlist was visually assessed; this is not proof that every possible outfit is unsuitable."])
        return response("recommended", "Here are the outfits I found for your request.",
                        outfits=accepted[:intent.count], model_version=scorer.version,
                        warnings=([f"Found {len(accepted)} distinct main outfits out of {intent.count} requested within the assessed shortlist."] if len(accepted) < intent.count else []) + ["Candidate retrieval and visual shortlisting are bounded; results are not an exhaustive search of every outfit.",
                                  "Ranking scores are uncalibrated leave-one-out retrieval scores, not probabilities of suitability.",
                                  "Visual suitability is a model judgment and has not been validated by a human wardrobe study."])
    except (ModelUnavailable, LLMUnavailable, OSError) as exc:
        return response("unavailable", str(exc) if isinstance(exc, (ModelUnavailable, LLMUnavailable)) else "A required wardrobe image could not be read.")
