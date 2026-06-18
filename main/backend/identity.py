import re
from config import IS_LOCAL, LOCAL_OWNER, MAX_CLIENT_ID_LEN

_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{8,128}$")


def client_id(request):
    cid = request.headers.get("x-client-id") or request.headers.get("X-Client-Id")
    if not cid:
        return None
    cid = cid.strip()
    if len(cid) > MAX_CLIENT_ID_LEN:
        return None
    if not _CLIENT_ID_RE.match(cid):
        return None
    return cid


def owner_for(request):
    if IS_LOCAL:
        return LOCAL_OWNER
    cid = client_id(request)
    if cid:
        return f"c:{cid}"
    try:
        ip = request.client.host
    except Exception:
        ip = "unknown"
    return f"ip:{ip}"


def owner_ip(request):
    try:
        return request.client.host
    except Exception:
        return "unknown"
