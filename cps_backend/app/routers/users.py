from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    ClickRequest,
    ClickResponse,
    UserResponse
)
from app.services.cps import get_user, calculate_cps

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get("/{name}", response_model=UserResponse)
def read_user(
    name: str = Path(min_length=1, max_length=80),
    db: Session = Depends(get_db)
):

    user = get_user(name, db)

    return {
        "Name": name,
        "maxCPS": user.max_cps if user else 0.0
    }


@router.post("/{name}", response_model=ClickResponse)
def register_clicks(
    request: ClickRequest,
    name: str = Path(min_length=1, max_length=80),
    db: Session = Depends(get_db)
):

    return calculate_cps(
        name=name,
        clicks=request.clicks,
        db=db
    )