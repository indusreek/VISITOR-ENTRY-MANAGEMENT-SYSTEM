from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, dashboard, reports, visitors

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


def seed_admin() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    username="admin",
                    password_hash=hash_password("Admin@123"),
                    full_name="Front Desk Admin",
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_admin()
    yield


app = FastAPI(
    title="Visitor Entry Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(visitors.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
