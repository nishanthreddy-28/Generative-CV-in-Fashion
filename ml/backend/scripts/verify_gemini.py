"""Check the live Gemini adapter using only generated sample data."""

import base64
import io
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chat.stylist import GeminiStylist
from app.chat.stylist import LLMUnavailable
from app.contracts.styling import Assessments
from app.contracts.styling import Intent


def main():
    stylist = GeminiStylist()
    print(f"Testing {stylist.model} with synthetic data", flush=True)
    try:
        result = stylist.interpret("Recommend one casual outfit.", Intent(), [], [])
        if result.needs_clarification or result.intent.required_ids or result.intent.excluded_ids:
            raise LLMUnavailable("Unexpected interpretation of the sample request.")
        print("PASS: chat interpretation", flush=True)

        image = io.BytesIO()
        Image.new("RGB", (128, 128), "blue").save(image, format="JPEG")
        result = stylist.call(
            Assessments,
            "Return one assessment for the supplied candidate ID. Mark it suitable if the image is blue, "
            "otherwise mark it unsuitable. State the visible color in the reason.",
            {"candidate_id": "sample"},
            [base64.b64encode(image.getvalue()).decode("ascii")],
        )
        if len(result.assessments) != 1:
            raise LLMUnavailable("Expected one assessment for the sample image.")
        assessment = result.assessments[0]
        if assessment.candidate_id != "sample" or assessment.decision != "suitable" or "blue" not in assessment.reason.lower():
            raise LLMUnavailable("Unexpected assessment of the sample image.")
        print("PASS: image input and structured response")
    except LLMUnavailable as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
