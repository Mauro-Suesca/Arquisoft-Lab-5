from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True
    )

    max_cps = Column(
        Float,
        nullable=False,
        default=0.0
    )