from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in_minutes: int


class TokenPayload(BaseModel):
    sub: str
    role: str = Field(description="ingest | officer | admin")
