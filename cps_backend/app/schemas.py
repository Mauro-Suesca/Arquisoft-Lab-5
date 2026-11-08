from pydantic import BaseModel, Field


class ClickRequest(BaseModel):
    clicks: int = Field(ge=0)


class UserResponse(BaseModel):
    Name: str
    maxCPS: float


class ClickResponse(BaseModel):
    Name: str
    CPS: float
    maxCPS: float