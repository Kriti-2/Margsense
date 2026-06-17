from fastapi import APIRouter, HTTPException, Request, status

from app.auth import LoginRequest, TokenResponse, create_access_token
from app.config import get_settings
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def officer_login(request: Request, body: LoginRequest):
    """Issue a JWT for officer dashboard APIs (shift planner, severity queue, jobs)."""
    settings = get_settings()
    if body.username != settings.officer_username or body.password != settings.officer_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token, expires = create_access_token(body.username, role="officer")
    return TokenResponse(
        access_token=token,
        role="officer",
        expires_in_minutes=expires,
    )


@router.post("/ingest-token", response_model=TokenResponse)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def ingest_token(request: Request, body: LoginRequest):
    """Issue a JWT for BTP/SCITA ingest when API keys cannot be used."""
    settings = get_settings()
    if body.username != settings.ingest_username or body.password != settings.ingest_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token, expires = create_access_token(body.username, role="ingest")
    return TokenResponse(
        access_token=token,
        role="ingest",
        expires_in_minutes=expires,
    )
