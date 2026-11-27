"""Session-only hosted generation with CPU garment preparation."""
import base64
import io
import json
import tempfile
from pathlib import Path
from PIL import Image
from fastapi import HTTPException
_parser=None

def generate(person,garment,category,provider,prepared=False):
    global _parser
    from scripts.prepare_tryon_background import prepare as background
    from scripts.prepare_tryon_garments import prepare as isolate
    from app.tryon.hosted import run_manifest
    from app.tryon.common import HostedTryOnError
    if provider=="idm" and category!="tops":raise HTTPException(422,"IDM-VTON supports one upper-body garment.")
    try:
        with tempfile.TemporaryDirectory(prefix="drape-session-tryon-") as temporary:
            root=Path(temporary)
            person.save(root/"person.png")
            garment.save(root/"garment.png")
            plan={"person":str(root/"person.png"),"output":str(root/"result.png"),"provider":provider,
                "item_ids":[],"warnings":[],"garments":[{"path":str(root/"garment.png"),"category":category,"photo_type":"auto"}]}
            manifest=root/"manifest.json"
            manifest.write_text(json.dumps(plan),encoding="utf-8")
            if prepared:
                plan["garments"][0]["prepared_path"]=str(root/"garment.png")
            else:
                background(manifest)
                if _parser is None:
                    from fashn_human_parser import FashnHumanParser
                    _parser=FashnHumanParser(device="cpu")
                prepared_manifest=root/"prepared-manifest.json"
                isolate(prepared_manifest,parser=_parser)
                plan=json.loads(prepared_manifest.read_text(encoding="utf-8"))
            if provider=="weshop":
                run_manifest(plan)
                audit=json.loads(manifest.read_text(encoding="utf-8"))
            else:
                from app.tryon.idm import run_manifest as idm
                refs=[dict(item,path=item["prepared_path"],rotation=0) for item in plan["garments"]]
                idm(dict(plan,garments=refs))
                audit={"actual_provider":"idm","attempts":[{"provider":"idm","status":"completed"}],
                    "warnings":["IDM-VTON is an upper-body noncommercial research demo with shared availability."]}
            with Image.open(plan["output"]) as source:
                result=source.convert("RGB");result.thumbnail((2048,2048))
                buffer=io.BytesIO();result.save(buffer,"JPEG",quality=85)
            return {"imageBase64":base64.b64encode(buffer.getvalue()).decode(),"mime":"image/jpeg",
                "provider":audit["actual_provider"],"attempts":audit.get("attempts",[]),"warnings":audit.get("warnings",[])}
    except HostedTryOnError:
        raise HTTPException(503,"Hosted try-on is unavailable. Please try later.") from None
