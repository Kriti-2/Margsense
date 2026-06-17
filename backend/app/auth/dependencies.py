from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import decode_access_token
from app.auth.schemas import TokenPayload
from app.config import get_settings

_bearer = HTTPBearer(auto_error=False)


def _dev_officer() -> TokenPayload:
    return TokenPayload(sub="dev-officer", role="officer")


def _dev_ingest() -> TokenPayload:
    return TokenPayload(sub="dev-ingest", role="ingest")


async def require_ingest_auth(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TokenPayload:
    settings = get_settings()
    if not settings.auth_enabled:
        return _dev_ingest()

    if settings.ingest_api_key and x_api_key == settings.ingest_api_key:
        return TokenPayload(sub="ingest-api-key", role="ingest")

    if credentials and credentials.scheme.lower() == "bearer":
        payload = decode_access_token(credentials.credentials)
        if payload.role in ("ingest", "admin"):
            return payload

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid X-API-Key or ingest JWT required",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_officer_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TokenPayload:
    settings = get_settings()
    if not settings.auth_enabled:
        return _dev_officer()

    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Officer bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if payload.role not in ("officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer role required",
        )
    return payload
