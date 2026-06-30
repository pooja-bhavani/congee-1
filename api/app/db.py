"""Database engine + session. Aurora PostgreSQL (prod) or SQLite (dev)."""
from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if not settings.is_postgres else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_pgvector() -> None:
    if not settings.is_postgres:
        return
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
