"""Handle small talk without fetching candidates or spending inference quota."""
import re
FALLBACK = "Please provide an outfit recommendation request. For example: 'Suggest a casual outfit for college' or 'Build an outfit around my blue shirt'."


def conversational_reply(message):
    text = message.strip().casefold()
    text = re.sub(r"[!?. ,]+$", "", text)
    if re.fullmatch(r"(?:h+i+|h+e+y+|hello+|hiya|howdy|good (?:morning|afternoon|evening))(?: there)?", text):
        return FALLBACK
    if re.fullmatch(r"(?:thanks?(?: you)?|thank you|ty|cheers)(?: so much)?", text):
        return FALLBACK
    if text in {"how are you", "how are you doing", "what's up", "whats up"}:
        return FALLBACK
    if text in {"help", "what can you do", "who are you"}:
        return FALLBACK
    return None
