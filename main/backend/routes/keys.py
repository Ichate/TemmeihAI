from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import IS_LOCAL, PROVIDERS
import keys
import llm

router = APIRouter()


class SaveKeyRequest(BaseModel):
    label: str
    provider: str
    apiKey: str


class DeleteKeyRequest(BaseModel):
    label: str


class VerifySavedRequest(BaseModel):
    label: str


def _guard():
    if not IS_LOCAL:
        return JSONResponse({"success": False, "error": "key vault is local mode only"}, status_code=403)
    return None


@router.get("/keys")
async def get_keys():
    blocked = _guard()
    if blocked:
        return blocked
    return {"success": True, "keys": keys.list_keys()}


@router.post("/keys/save")
async def save_key(req: SaveKeyRequest):
    blocked = _guard()
    if blocked:
        return blocked
    if req.provider not in PROVIDERS:
        return {"success": False, "error": "unsupported provider"}
    if not req.apiKey or len(req.apiKey) > 256:
        return {"success": False, "error": "invalid api key"}
    models, error = await llm.fetch_models(req.provider, req.apiKey)
    if error:
        return {"success": False, "error": f"key check failed: {error}"}
    ok, msg = keys.save_key(req.label, req.provider, req.apiKey)
    if not ok:
        return {"success": False, "error": msg}
    return {"success": True, "models": models}


@router.post("/keys/delete")
async def delete_key(req: DeleteKeyRequest):
    blocked = _guard()
    if blocked:
        return blocked
    if keys.delete_key(req.label):
        return {"success": True}
    return {"success": False, "error": "no such key"}


@router.post("/keys/verify-saved")
async def verify_saved(req: VerifySavedRequest):
    blocked = _guard()
    if blocked:
        return blocked
    key = keys.get_key(req.label)
    if not key:
        return {"success": False, "error": "no such saved key"}
    provider = keys.get_provider(req.label)
    if not provider:
        return {"success": False, "error": "saved key has no provider"}
    models, error = await llm.fetch_models(provider, key)
    if error:
        return {"success": False, "error": error}
    return {"success": True, "models": models, "provider": provider}
