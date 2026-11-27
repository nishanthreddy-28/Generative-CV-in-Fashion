"""Signed inference receipts preserve originals without trusting client echoes."""
import hashlib
import hmac
import time
from uuid import UUID,uuid4
import jwt
from fastapi import HTTPException
from .ml_contracts import BodyAnalysis

AUDIENCE="drape:pose-analysis:v1"

def key(settings):
    if not (settings.ml_receipt_signing_key or settings.ml_worker_token):
        raise HTTPException(503,"Inference signing is not configured.")
    return hmac.new((settings.ml_receipt_signing_key or settings.ml_worker_token).get_secret_value().encode(),AUDIENCE.encode(),hashlib.sha256).digest()

def issue(settings,subject,image_id,image_hash,analysis):
    now=int(time.time())
    return jwt.encode({"sub":str(subject),"aud":AUDIENCE,"iat":now,"exp":now+900,"jti":str(uuid4()),
        "imageId":str(image_id),"imageHash":image_hash,"analysis":analysis.model_dump()},key(settings),algorithm="HS256")

def verify(settings,receipt,subject,image_id,*,saved=False):
    try:
        data=jwt.decode(receipt,key(settings),algorithms=["HS256"],audience=AUDIENCE,
            options={"require":["sub","aud","iat","exp","jti","imageId","imageHash","analysis"],"verify_exp":not saved})
        UUID(data["jti"])
        if data["sub"]!=str(subject) or data["imageId"]!=str(image_id) or not isinstance(data["imageHash"],str):
            raise ValueError()
        analysis=BodyAnalysis.model_validate(data["analysis"])
        originals=analysis.original_estimates.model_dump()
        if any(getattr(analysis,name)!=value for name,value in originals.items()):
            raise ValueError()
        return data,analysis
    except (jwt.PyJWTError,ValueError,TypeError,KeyError):
        raise HTTPException(409,"Analysis is invalid or expired. Analyse the current photo again.") from None
