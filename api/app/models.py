"""Engram data model.

A Photo is a memory: the image + what Bedrock understood about it + a vector
embedding for semantic recall. On Aurora a parallel pgvector column powers ANN
search (see infra/aurora_schema.sql).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(64), index=True, default="me")
    url: Mapped[str] = mapped_column(String(1024))
    s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # What Bedrock vision understood.
    caption: Mapped[str] = mapped_column(Text, default="")
    scene: Mapped[str] = mapped_column(String(255), default="")
    mood: Mapped[str] = mapped_column(String(128), default="", index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    people: Mapped[int] = mapped_column(Integer, default=0)
    palette: Mapped[list] = mapped_column(JSON, default=list)

    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)

    embedding: Mapped[list] = mapped_column(JSON, default=list)

    # Cognee linkage: the dataset this memory lives in, and whether the graph
    # has been built for it yet (pending until cognify finishes in the background).
    cognee_dataset_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cognee_status: Mapped[str] = mapped_column(String(16), default="pending")

    def public(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "caption": self.caption,
            "scene": self.scene,
            "mood": self.mood,
            "tags": self.tags,
            "people": self.people,
            "palette": self.palette,
            "takenAt": self.taken_at.isoformat() if self.taken_at else None,
            "favorite": self.favorite,
            "memoryStatus": self.cognee_status,
        }


class Frame(Base):
    """A display configuration — what a given frame plays."""
    __tablename__ = "frames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(64), index=True, default="me")
    name: Mapped[str] = mapped_column(String(128), default="Living Room")
    mode: Mapped[str] = mapped_column(String(64), default="shuffle")  # shuffle | mood | search | favorites | on-this-day
    query: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
