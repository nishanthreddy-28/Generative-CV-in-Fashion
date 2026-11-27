"""Bounded complementary retrieval, followed by separate whole-outfit scoring.

Retrieval uses the CIR model's own feature space, never categorization vectors.
The beam is approximate: it does not certify an exhaustive wardrobe search.
"""
import math

from app.recommendations.scorer import ModelUnavailable

POOL_PER_TEMPLATE = 64
EXACT_POOL_LIMIT = 256
DIVERSITY_WEIGHT = 0.08


def signature(items):
    return tuple(sorted(item["id"] for item in items))


def diverse(ranked, count, required=(), preference=lambda _: 0):
    """MMR selection; a different jacket alone is not a different base outfit.

    Inputs are (items, model_score). Locks never count against variety.
    """
    ranked = sorted(ranked, key=lambda pair: (-(pair[1] + preference(pair[0])), signature(pair[0])))
    selected = []
    required = set(required)

    def variable_ids(items):
        core = {item["id"] for item in items if item["slot"] != "outer"} - required
        return core or ({item["id"] for item in items} - required)

    remaining = [[items, score, score + preference(items), variable_ids(items), 0.0] for items, score in ranked]
    while remaining and len(selected) < count:
        best = max(range(len(remaining)), key=lambda index: remaining[index][2] - DIVERSITY_WEIGHT * remaining[index][4])
        items, score, _, chosen_ids, _ = remaining.pop(best)
        selected.append((items, score))
        for entry in remaining:
            ids = entry[3]
            overlap = len(ids & chosen_ids) / max(1, len(ids | chosen_ids))
            entry[4] = max(entry[4], overlap)
    return selected


def retrieve_pool(slots, outers, required, retriever, is_seen=lambda _: False, preference=lambda _: 0):
    """Expand top→bottom→shoes / full→shoes; retain both layer templates.

    Each template keeps at most 64 candidates. The final pool has at most 256
    candidates regardless of the original Cartesian product. Every slot option
    is considered at its expansion stage; no first-N item truncation is used.
    """
    required = set(required)
    locked_slots = {item["slot"] for options in slots.values() for item in options if item["id"] in required}

    def expand(beam, options, *, final=False):
        if not beam or not options:
            return []
        contexts = [items for items, _, _ in beam]
        values = retriever.retrieve_scores(contexts, options)
        if (len(values) != len(beam) or any(len(row) != len(options) for row in values)
                or any(not math.isfinite(value) for row in values for value in row)):
            raise ModelUnavailable("Invalid complementary retrieval scores")
        expanded = []
        evidence = {}
        for (items, total, steps), scores in zip(beam, values):
            for item, score in zip(options, scores):
                candidate = items + [item]
                if final and (not required <= set(signature(candidate)) or is_seen(candidate)):
                    continue
                mean = (total + score) / (steps + 1)
                expanded.append((candidate, mean))
                evidence[signature(candidate)] = (total + score, steps + 1)
        return [(items, *evidence[signature(items)]) for items, _ in
                diverse(expanded, POOL_PER_TEMPLATE, required, preference)]

    result = []
    templates = []
    if "full" not in locked_slots and slots["top"] and slots["bottom"]:
        templates.append((slots["top"], slots["bottom"]))
    if not locked_slots & {"top", "bottom"} and slots["full"]:
        templates.append((slots["full"], None))
    for seeds, bottoms in templates:
        for layered in (False, True):
            if (not layered and None not in outers) or (layered and not any(item is not None for item in outers)):
                continue
            beam = [([item], 0.0, 0) for item in sorted(seeds, key=lambda item: item["id"])]
            if bottoms is not None:
                beam = expand(beam, bottoms)
            beam = expand(beam, slots["shoes"], final=not layered)
            if layered:
                beam = expand(beam, [item for item in outers if item is not None], final=True)
            result.extend(items for items, _, _ in beam)
    return result
