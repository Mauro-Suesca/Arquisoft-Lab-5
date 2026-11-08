from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import Base, engine
from app.routers import users


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    yield


app = FastAPI(
    title="CPS Calculator",
    description="API for calculating clicks per second",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(users.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}