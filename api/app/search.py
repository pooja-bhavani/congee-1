"""Semantic memory search — natural language over photo embeddings.

pgvector ANN on Aurora ('A <=> B' cosine distance); in-app cosine on SQLite.
This is what lets you search "sunsets at the beach with friends" and get the
right memories back.
"""
from __future__ import annotations

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from .bedrock import embed
from .config import settings
from .models import Photo


def _cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, float), np.asarray(b, float)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    return float(va @ vb / (na * nb)) if na and nb else 0.0


def _pg(db: Session, owner: str, qvec: list[float], limit: int) -> list[tuple[int, float]]:
    lit = "[" + ",".join(str(x) for x in qvec) + "]"
    rows = db.execute(
        text(
            """
            SELECT id, 1 - (embedding_vec <=> :q) AS sim
            FROM photos WHERE owner = :owner AND embedding_vec IS NOT NULL
            ORDER BY embedding_vec <=> :q LIMIT :lim
            """
        ),
        {"q": lit, "owner": owner, "lim": limit},
    ).all()
    return [(r[0], float(r[1])) for r in rows]


def _local(db: Session, owner: str, qvec: list[float], limit: int) -> list[tuple[int, float]]:
    photos = db.query(Photo).filter(Photo.owner == owner).all()
    scored = [(p.id, _cosine(qvec, p.embedding)) for p in photos if p.embedding]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


def memory_map(db: Session, owner: str = "me") -> list[dict]:
    """Project memory embeddings to 2D (PCA) for the constellation view.

    Reveals the structure Bedrock + the embeddings created — similar memories
    cluster together — turning the vector space into something you can *see*."""
    photos = [p for p in db.query(Photo).filter(Photo.owner == owner).all() if p.embedding]
    if len(photos) < 3:
        return [{**p.public(), "x": 0.5, "y": 0.5} for p in photos]
    X = np.array([p.embedding for p in photos], dtype=float)
    Xc = X - X.mean(axis=0)
    # top-2 principal components via SVD
    _, _, Vt = np.linalg.svd(Xc, full_matrices=False)
    coords = Xc @ Vt[:2].T
    # normalize each axis to [0.05, 0.95]
    mn, mx = coords.min(axis=0), coords.max(axis=0)
    rng = np.where((mx - mn) == 0, 1, mx - mn)
    norm = 0.05 + 0.9 * (coords - mn) / rng
    return [
        {**p.public(), "x": round(float(norm[i, 0]), 4), "y": round(float(norm[i, 1]), 4)}
        for i, p in enumerate(photos)
    ]


def _text_pg(db: Session, owner: str, query: str, limit: int) -> list[int]:
    """Full-text (sparse) ranking over caption/scene/mood/tags via Postgres FTS."""
    rows = db.execute(
        text(
            """
            SELECT id FROM photos
            WHERE owner = :owner
              AND to_tsvector('english',
                    coalesce(caption,'') || ' ' || coalesce(scene,'') || ' ' ||
                    coalesce(mood,'') || ' ' || coalesce(tags::text,''))
                  @@ websearch_to_tsquery('english', :q)
            ORDER BY ts_rank(
                    to_tsvector('english', coalesce(caption,'') || ' ' ||
                        coalesce(scene,'') || ' ' || coalesce(mood,'') || ' ' ||
                        coalesce(tags::text,'')),
                    websearch_to_tsquery('english', :q)) DESC
            LIMIT :lim
            """
        ),
        {"owner": owner, "q": query, "lim": limit},
    ).all()
    return [r[0] for r in rows]


def _text_local(db: Session, owner: str, query: str, limit: int) -> list[int]:
    terms = [t for t in query.lower().split() if len(t) > 2]
    photos = db.query(Photo).filter(Photo.owner == owner).all()
    scored = []
    for p in photos:
        hay = f"{p.caption} {p.scene} {p.mood} {' '.join(p.tags or [])}".lower()
        hits = sum(1 for t in terms if t in hay)
        if hits:
            scored.append((p.id, hits))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [pid for pid, _ in scored[:limit]]


def _rrf(rankings: list[list[int]], k: int = 60) -> dict[int, float]:
    """Reciprocal Rank Fusion — combine dense + sparse rankings robustly."""
    fused: dict[int, float] = {}
    for ranking in rankings:
        for rank, pid in enumerate(ranking):
            fused[pid] = fused.get(pid, 0.0) + 1.0 / (k + rank + 1)
    return fused


def search_memories(db: Session, query: str, owner: str = "me", limit: int = 24) -> list[dict]:
    """Hybrid retrieval: dense (pgvector) + sparse (full-text), fused with RRF."""
    qvec = embed(query)
    dense = _pg(db, owner, qvec, 40) if settings.is_postgres else _local(db, owner, qvec, 40)
    dense_ids = [pid for pid, _ in dense]
    sim = {pid: s for pid, s in dense}
    sparse_ids = _text_pg(db, owner, query, 40) if settings.is_postgres else _text_local(db, owner, query, 40)

    fused = _rrf([dense_ids, sparse_ids])
    ranked = sorted(fused.items(), key=lambda x: x[1], reverse=True)[:limit]

    out = []
    for pid, score in ranked:
        p = db.query(Photo).get(pid)
        if p:
            out.append({**p.public(), "score": round(sim.get(pid, score), 4)})
    return out
