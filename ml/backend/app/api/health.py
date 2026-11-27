from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request):
    tagger = getattr(request.app.state, "tagger", None)
    return {
        "status": "ok" if tagger else "loading",
        "device": getattr(tagger, "device", None),
    }
