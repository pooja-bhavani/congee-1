"""Photo upload, URL ingest, listing, favorites."""
from __future__ import annotations

import urllib.request

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import cognee_memory
from ..cognee_memory import weave_memory
from ..db import get_db
from ..ingest import ingest_photo
from ..models import Photo
from ..schemas import IngestUrlRequest

router = APIRouter(prefix="/api", tags=["photos"])


@router.post("/photos")
async def upload_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    owner: str = Form("me"),
    db: Session = Depends(get_db),
) -> dict:
    data = await file.read()
    ext = (file.filename or "x.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    photo = ingest_photo(db, data, owner=owner, ext=ext)
    # remember(): build the knowledge graph off the request path so upload is instant.
    background_tasks.add_task(weave_memory, photo.id)
    return photo.public()


@router.post("/photos/url")
def ingest_from_url(
    req: IngestUrlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    try:
        with urllib.request.urlopen(req.url, timeout=20) as r:  # noqa: S310
            data = r.read()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not fetch image: {e}")
    ext = req.url.rsplit(".", 1)[-1].lower().split("?")[0]
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    photo = ingest_photo(db, data, owner=req.owner, ext=ext, url=req.url)
    background_tasks.add_task(weave_memory, photo.id)
    return photo.public()


@router.get("/photos")
def list_photos(owner: str = "me", limit: int = 60, db: Session = Depends(get_db)) -> list[dict]:
    photos = (
        db.query(Photo).filter(Photo.owner == owner)
        .order_by(Photo.taken_at.desc()).limit(limit).all()
    )
    return [p.public() for p in photos]


@router.post("/photos/{photo_id}/favorite")
def toggle_favorite(photo_id: int, db: Session = Depends(get_db)) -> dict:
    p = db.query(Photo).get(photo_id)
    if not p:
        raise HTTPException(404, "not found")
    p.favorite = not p.favorite
    db.commit()
    return p.public()


@router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: int, db: Session = Depends(get_db)) -> dict:
    p = db.query(Photo).get(photo_id)
    if not p:
        raise HTTPException(404, "not found")
    # forget(): remove this memory from the graph + vectors before dropping the row.
    try:
        await cognee_memory.forget_photo(p)
    except Exception:  # noqa: BLE001
        pass
    # Best-effort: remove the local file if we stored one.
    if p.url and "/media/" in p.url:
        from pathlib import Path
        from ..storage import UPLOAD_DIR
        fn = p.url.rsplit("/media/", 1)[-1]
        try:
            (UPLOAD_DIR / fn).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
    db.delete(p)
    db.commit()
    return {"deleted": photo_id}
