"""Search, collections, frame feed — the intelligent surfaces."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from .. import curation, voice
from ..db import get_db
from ..models import Photo
from ..schemas import AskRequest, ReelRequest, SearchRequest
from ..search import memory_map, search_memories

router = APIRouter(prefix="/api", tags=["discover"])


@router.post("/search")
def search(req: SearchRequest, db: Session = Depends(get_db)) -> list[dict]:
    """Natural-language memory search via Aurora pgvector."""
    return search_memories(db, req.query, owner=req.owner, limit=req.limit)


@router.get("/collections")
def collections(owner: str = "me", db: Session = Depends(get_db)) -> list[dict]:
    return curation.collections(db, owner=owner)


@router.get("/map")
def map_view(owner: str = "me", db: Session = Depends(get_db)) -> list[dict]:
    """2D PCA projection of memory embeddings — the semantic constellation."""
    return memory_map(db, owner=owner)


@router.get("/on-this-day")
def on_this_day(owner: str = "me", db: Session = Depends(get_db)) -> list[dict]:
    return curation.on_this_day(db, owner=owner)


@router.get("/frame/feed")
def frame_feed(
    owner: str = "me", mode: str = "shuffle", query: str = "",
    db: Session = Depends(get_db),
) -> list[dict]:
    return curation.frame_feed(db, owner=owner, mode=mode, query=query)


@router.get("/frame/story/{photo_id}")
def frame_story(photo_id: int, db: Session = Depends(get_db)) -> dict:
    from ..models import Photo
    p = db.query(Photo).get(photo_id)
    if not p:
        return {"story": ""}
    return {"story": curation.story_for(p.public())}


@router.post("/ask")
async def ask(req: AskRequest, db: Session = Depends(get_db)) -> dict:
    """Talk to your memories — graph-grounded recall over the Cognee knowledge
    graph. Returns an answer that connects memories across photos, plus the exact
    photos it drew on. Falls back to local vector search if no graph match."""
    from .. import cognee_memory

    res = await cognee_memory.recall_answer(req.question, mode=req.mode)
    photos: list[dict] = []
    if res["photo_ids"]:
        rows = db.query(Photo).filter(Photo.id.in_(res["photo_ids"])).all()
        by_id = {p.id: p for p in rows}
        photos = [by_id[i].public() for i in res["photo_ids"] if i in by_id]
    if not photos:
        photos = search_memories(db, req.question, owner=req.owner, limit=4)
    answer = res["answer"] or "I don't have a memory that answers that yet."
    return {"answer": answer, "photos": photos, "qa_id": res.get("qa_id"), "mode": res.get("mode")}


@router.post("/reel")
def reel(req: ReelRequest, db: Session = Depends(get_db)) -> dict:
    """An AI-narrated cinematic memory reel."""
    return curation.reel(db, owner=req.owner, mode=req.mode, query=req.query, limit=req.limit)


@router.get("/narrate/{photo_id}")
def narrate(photo_id: int, db: Session = Depends(get_db)) -> Response:
    """Amazon Polly reads a warm, human narration of the memory (accessibility)."""
    p = db.query(Photo).get(photo_id)
    text = curation.narration_text(p.public()) if p else ""
    return Response(
        content=voice.synthesize(text),
        media_type="audio/mpeg",
        # Don't let the browser replay stale audio — the server already caches
        # the synthesized bytes in-memory, so re-fetching is instant and always
        # returns the single, current Ruth voice.
        headers={"Cache-Control": "no-store, must-revalidate"},
    )
