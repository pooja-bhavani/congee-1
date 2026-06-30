"""AI curation — what makes the frame feel alive.

- collections(): groups memories into themed, AI-titled collections by mood.
- frame_feed(): the ordered stream a frame plays, per display mode.
- on_this_day(): resurfaces memories from this date in past years.
"""
from __future__ import annotations

import random
from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from . import bedrock
from .models import Photo
from .search import search_memories

_MOOD_TITLES = {
    "romantic": "Tender Moments",
    "carefree": "Golden Days",
    "joyful": "Pure Joy",
    "peaceful": "Quiet Light",
    "nostalgic": "Looking Back",
    "adventurous": "Far From Home",
    "cozy": "Warm & Close",
}


def _mood_key(mood: str) -> str:
    m = (mood or "").lower()
    for k in _MOOD_TITLES:
        if k in m:
            return k
    return m.split(",")[0].strip() or "moments"


def collections(db: Session, owner: str = "me", min_size: int = 2) -> list[dict]:
    photos = db.query(Photo).filter(Photo.owner == owner).all()
    groups: dict[str, list[Photo]] = defaultdict(list)
    for p in photos:
        groups[_mood_key(p.mood)].append(p)

    out = []
    for key, items in groups.items():
        if len(items) < min_size:
            continue
        title = _MOOD_TITLES.get(key, key.title())
        out.append({
            "key": key,
            "title": title,
            "description": f"{len(items)} memories that feel {key}",
            "cover": items[0].url,
            "count": len(items),
            "photos": [p.public() for p in items],
        })
    out.sort(key=lambda c: c["count"], reverse=True)
    return out


def on_this_day(db: Session, owner: str = "me") -> list[dict]:
    today = datetime.utcnow()
    photos = db.query(Photo).filter(Photo.owner == owner).all()
    hits = [
        p for p in photos
        if p.taken_at and p.taken_at.year < today.year
        and abs(p.taken_at.timetuple().tm_yday - today.timetuple().tm_yday) <= 3
    ]
    return [p.public() for p in hits]


def frame_feed(db: Session, owner: str = "me", mode: str = "shuffle", query: str = "") -> list[dict]:
    """Ordered memories for the frame to rotate through."""
    if mode == "search" and query:
        return search_memories(db, query, owner=owner, limit=30)

    q = db.query(Photo).filter(Photo.owner == owner)
    if mode == "favorites":
        q = q.filter(Photo.favorite.is_(True))
    photos = q.all()

    if mode == "on-this-day":
        otd = on_this_day(db, owner)
        if otd:
            return otd

    pub = [p.public() for p in photos]
    if mode == "shuffle":
        random.shuffle(pub)
    elif mode == "mood" and query:
        pub = [p for p in pub if query.lower() in (p["mood"] or "").lower()] or pub
    return pub


_STORY_SYSTEM = (
    "You are Engram. Given a photo's caption and tags, write ONE short, warm, "
    "reflective sentence (max 18 words) to display beneath it on a memory frame. "
    "No quotes, no emojis."
)


def story_for(photo: dict) -> str:
    try:
        ctx = f"caption: {photo['caption']}; tags: {', '.join(photo.get('tags', []))}"
        return bedrock.generate(_STORY_SYSTEM, ctx, max_tokens=60).strip()
    except Exception:  # noqa: BLE001
        return photo.get("caption", "")


# Warm spoken narration — written to be *heard*, with natural rhythm.
_NARRATE_SYSTEM = (
    "You are Engram, gently narrating a photo aloud to someone reminiscing. "
    "Write 1-2 short, warm sentences in a reflective, conversational tone — the "
    "way a loved one points at a picture and remembers. Use natural commas for "
    "rhythm. Max 28 words. No quotes, no emojis."
)
_narration_cache: dict[int, str] = {}


def narration_text(photo: dict) -> str:
    pid = photo.get("id", 0)
    if pid in _narration_cache:
        return _narration_cache[pid]
    try:
        txt = bedrock.generate(
            _NARRATE_SYSTEM,
            f"Photo: {photo['caption']}. Mood: {photo.get('mood','')}.",
            max_tokens=90,
        ).strip()
    except Exception:  # noqa: BLE001
        txt = photo.get("caption", "")
    _narration_cache[pid] = txt
    return txt


# --------------------------------------------------------------------------- #
# Talk to your memories (RAG over the photo embeddings)
# --------------------------------------------------------------------------- #
_ASK_SYSTEM = (
    "You are Engram, a warm companion helping someone reminisce. Answer their "
    "question in 2-4 sentences using ONLY the provided memories. Reference specific "
    "moments naturally and warmly. If the memories don't cover it, say so gently."
)


def ask(db: Session, question: str, owner: str = "me") -> dict:
    hits = search_memories(db, question, owner=owner, limit=6)
    if not hits:
        return {"answer": "I don't have memories that match that yet — add a few "
                          "photos and ask me again.", "photos": []}
    ctx = "\n".join(
        f"- {p['caption']} (mood: {p['mood']}; "
        f"{(p['takenAt'] or '')[:10]})" for p in hits
    )
    try:
        answer = bedrock.generate(
            _ASK_SYSTEM, f"Question: {question}\n\nYour memories:\n{ctx}", max_tokens=400
        ).strip()
    except Exception:  # noqa: BLE001
        answer = f"I found {len(hits)} memories that feel connected to that."
    return {"answer": answer, "photos": hits}


# --------------------------------------------------------------------------- #
# Memory Reel — a cinematic, AI-narrated montage
# --------------------------------------------------------------------------- #
_REEL_SYSTEM = (
    "You are Engram, composing a short memory reel. Given photo captions in order, "
    "return ONLY minified JSON: {\"title\":\"a short evocative reel title (max 5 words)\","
    "\"lines\":[\"one poetic narration line per photo, same order, max 12 words, no quotes\"]}."
    " The lines array length MUST equal the number of photos."
)


def reel(db: Session, owner: str = "me", mode: str = "shuffle",
         query: str = "", limit: int = 8) -> dict:
    photos = frame_feed(db, owner=owner, mode=mode, query=query)[:limit]
    if not photos:
        return {"title": "Your Reel", "photos": []}
    caps = "\n".join(f"{i+1}. {p['caption']}" for i, p in enumerate(photos))
    title, lines = "A Look Back", [p["caption"] for p in photos]
    try:
        import json
        import re
        raw = bedrock.generate(_REEL_SYSTEM, caps, max_tokens=600)
        data = json.loads(re.search(r"\{.*\}", raw, re.S).group(0))
        title = data.get("title", title)
        got = data.get("lines", [])
        if len(got) == len(photos):
            lines = got
    except Exception:  # noqa: BLE001
        pass
    return {"title": title, "photos": [{**p, "line": lines[i]} for i, p in enumerate(photos)]}
