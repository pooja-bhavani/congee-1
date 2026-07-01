"""Cognee memory-lifecycle endpoints: the knowledge graph, recall, improve, forget."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import cognee_memory, curation
from ..db import get_db
from ..models import Photo
from ..schemas import FeedbackRequest, RecallRequest

router = APIRouter(prefix="/api", tags=["memory"])


@router.post("/reweave")
async def reweave(background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> dict:
    """Re-run the graph weave for any photos not yet woven (e.g. after a restart
    interrupted background cognify). Schedules them serially via the graph lock."""
    pending = db.query(Photo).filter(Photo.cognee_status != "ready").all()
    for p in pending:
        background_tasks.add_task(cognee_memory.weave_memory, p.id)
    return {"reweaving": len(pending)}


@router.get("/graph")
async def graph() -> dict:
    """The knowledge graph (nodes + edges), each node attributed to its photo."""
    return await cognee_memory.export_graph()


@router.post("/recall")
async def recall(req: RecallRequest, db: Session = Depends(get_db)) -> dict:
    """recall(): graph-grounded answer + the photos it connected."""
    res = await cognee_memory.recall_answer(req.query, mode=req.mode)
    photos: list[dict] = []
    if res["photo_ids"]:
        rows = db.query(Photo).filter(Photo.id.in_(res["photo_ids"])).all()
        by_id = {p.id: p for p in rows}
        photos = [by_id[i].public() for i in res["photo_ids"] if i in by_id]
    return {
        "answer": res["answer"], "photos": photos,
        "qa_id": res.get("qa_id"), "mode": res.get("mode"),
    }


@router.post("/feedback")
async def feedback(req: FeedbackRequest, background_tasks: BackgroundTasks) -> dict:
    """Rate an answer (👍/👎). Records the feedback and folds it into the graph
    (improve) in the background so future recall gets better."""
    res = await cognee_memory.record_feedback(req.qa_id, req.score, req.text)
    background_tasks.add_task(cognee_memory.apply_feedback)
    return {**res, "learning": True}


@router.get("/concepts")
async def concepts(limit: int = 40) -> list[dict]:
    """Top concepts Cognee extracted across all memories (for the Concept map)."""
    return await cognee_memory.get_concepts(limit=limit)


@router.get("/photos/{photo_id}/connections")
async def connections(photo_id: int, db: Session = Depends(get_db)) -> list[dict]:
    """Memories connected to this photo through shared concepts."""
    links = await cognee_memory.get_connections(photo_id)
    if not links:
        return []
    ids = [l["photoId"] for l in links]
    rows = {p.id: p for p in db.query(Photo).filter(Photo.id.in_(ids)).all()}
    out = []
    for l in links:
        p = rows.get(l["photoId"])
        if p:
            out.append({"photo": p.public(), "shared": l["shared"], "count": l["count"]})
    return out


@router.get("/reminisce/thread")
async def reminisce_thread(start: int | None = None, db: Session = Depends(get_db)) -> dict:
    """A graph-guided reminiscence session: a chain of connected memories, each
    with warm narration and the concept that links it to the one before."""
    steps = await cognee_memory.reminiscence_thread(start)
    out: list[dict] = []
    for i, s in enumerate(steps):
        p = db.get(Photo, s["photo_id"])
        if p is None:
            continue
        pub = p.public()
        shared = s.get("shared") or []
        connect = None
        if i > 0:
            link = shared[0] if shared else "this feeling"
            connect = f"This one stays with {link}."
        out.append({
            "photo": pub,
            "narration": curation.narration_text(pub),
            "connect": connect,
            "shared": shared,
        })
    return {"thread": out}


@router.get("/forgotten-connection")
async def forgotten_connection(db: Session = Depends(get_db)) -> dict:
    """One surprising link the graph found — two memories that quietly rhyme."""
    res = await cognee_memory.forgotten_connection()
    if not res:
        return {"found": False}
    a = db.get(Photo, res["a"])
    b = db.get(Photo, res["b"])
    if a is None or b is None:
        return {"found": False}
    return {"found": True, "a": a.public(), "b": b.public(), "shared": res["shared"]}


@router.post("/improve")
async def improve() -> dict:
    """improve(): enrich the graph and report how much it grew."""
    return await cognee_memory.improve_memory()


@router.post("/forget/{photo_id}")
async def forget(photo_id: int, db: Session = Depends(get_db)) -> dict:
    """forget(): remove a photo's memory — its subgraph leaves the graph. Returns
    the before/after graph counts so the shrinkage is visible."""
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(404, "not found")
    before = await cognee_memory.graph_counts()
    res = await cognee_memory.forget_photo(photo)
    db.delete(photo)
    db.commit()
    after = await cognee_memory.graph_counts()
    return {
        "forgotten": photo_id,
        "removed_items": res.get("removed", 0),
        "before": {"nodes": before["nodes"], "edges": before["edges"]},
        "after": {"nodes": after["nodes"], "edges": after["edges"]},
        "gone": {
            "nodes": before["nodes"] - after["nodes"],
            "edges": before["edges"] - after["edges"],
        },
    }
