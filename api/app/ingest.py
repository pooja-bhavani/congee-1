"""Photo ingestion pipeline: understand → embed → store as a memory."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from .bedrock import caption_image, embed
from .config import settings
from .models import Photo
from .storage import save_image


def ingest_photo(
    db: Session,
    image_bytes: bytes,
    *,
    owner: str = "me",
    ext: str = "jpg",
    taken_at: datetime | None = None,
    url: str | None = None,
    s3_key: str | None = None,
) -> Photo:
    """Run a photo through Bedrock vision, embed the memory, and persist it."""
    if url is None:
        url, s3_key = save_image(image_bytes, ext=ext)

    memory = caption_image(image_bytes, media_type=f"image/{'jpeg' if ext in ('jpg','jpeg') else ext}")

    # Embed the rich memory text so search matches on meaning.
    embed_text = (
        f"{memory.get('caption','')}. Scene: {memory.get('scene','')}. "
        f"Mood: {memory.get('mood','')}. Tags: {', '.join(memory.get('tags', []))}."
    )

    photo = Photo(
        owner=owner,
        url=url,
        s3_key=s3_key,
        caption=memory.get("caption", ""),
        scene=memory.get("scene", ""),
        mood=memory.get("mood", ""),
        tags=memory.get("tags", []),
        people=int(memory.get("people", 0) or 0),
        palette=memory.get("palette", []),
        taken_at=taken_at or datetime.utcnow(),
        embedding=embed(embed_text),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    # On Aurora, populate the pgvector column immediately so uploads are
    # searchable right away (no manual reindex needed).
    if settings.is_postgres and photo.embedding:
        vec = "[" + ",".join(str(x) for x in photo.embedding) + "]"
        db.execute(
            text("UPDATE photos SET embedding_vec = (:v)::vector WHERE id = :id"),
            {"v": vec, "id": photo.id},
        )
        db.commit()
    return photo
