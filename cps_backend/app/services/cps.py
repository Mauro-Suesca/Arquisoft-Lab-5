from sqlalchemy.orm import Session

from app.models import User


def get_user(name: str, db: Session):
    return (
        db.query(User)
        .filter(User.name == name)
        .first()
    )


def calculate_cps(name: str, clicks: int, db: Session):

    cps = clicks / 5.0

    user = get_user(name, db)

    if user is None:

        user = User(
            name=name,
            max_cps=cps
        )

        db.add(user)

        previous_max = 0.0

    else:
        previous_max = user.max_cps

        if cps > user.max_cps:
            user.max_cps = cps

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "Name": name,
        "CPS": cps,
        "maxCPS": previous_max
    }