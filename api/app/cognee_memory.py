"""Engram's memory layer, powered by self-hosted Cognee.

Every photo becomes a node-rich memory in a local knowledge graph (kuzu) +
vector store (lancedb). This module is the single seam between Engram and
Cognee's 4-op lifecycle:

    remember -> remember_photo()   (add + cognify a photo's memory)
    recall   -> recall_answer()    (GRAPH_COMPLETION across all memories)
    improve  -> improve_memory()   (enrich the graph, report growth)
    forget   -> forget_photo()     (drop a memory; graph shrinks)

Plus export_graph() for the knowledge-graph UI.

IMPORTANT: the environment (brain paths + Bedrock/fastembed providers) MUST be
configured before `import cognee` runs — main.py does that, then imports this.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any

import cognee
from cognee import SearchType
from cognee.api.v1.session import add_feedback as _add_feedback
from cognee.api.v1.session import get_session as _get_session
from cognee.infrastructure.databases.graph import get_graph_engine

DATASET = "reverie"
SESSION = "engram_main"  # one rolling conversation so feedback accumulates
_PHOTO_RE = re.compile(r"\[?\s*PhotoID:\s*(\d+)\s*\]?", re.IGNORECASE)

# kuzu is a single-writer store; serialize all graph WRITES (remember/improve/
# forget) so overlapping background tasks can never collide on the lock file.
_GRAPH_LOCK = asyncio.Lock()


def memory_text(photo) -> str:
    """The natural-language memory Cognee ingests for a photo.

    The leading ``[PhotoID:{id}]`` marker is deliberate: GRAPH_COMPLETION answers
    preserve it (verified), so we can map an answer back to the exact photos."""
    tags = ", ".join(photo.tags or [])
    return (
        f"[PhotoID:{photo.id}] {photo.caption} "
        f"Scene: {photo.scene}. Mood: {photo.mood}. "
        f"Tags: {tags}. People in frame: {photo.people}."
    ).strip()


def _extract_dataset_id(add_result: Any) -> str | None:
    """cognee.add returns a PipelineRunInfo (dataset-level) — pull its dataset_id."""
    for attr in ("dataset_id", "id"):
        val = getattr(add_result, attr, None)
        if val:
            return str(val)
    if isinstance(add_result, dict):
        for k in ("dataset_id", "id"):
            if add_result.get(k):
                return str(add_result[k])
    return None


async def remember_photo(photo) -> dict:
    """remember(): weave a photo's memory into the knowledge graph.

    Runs add() (fast, enqueues) then cognify() (builds the graph). Callers should
    invoke this off the request path (BackgroundTasks) since cognify calls the LLM.
    Returns {ok, dataset_id} — dataset_id is stored on the Photo row for forget.
    """
    text = memory_text(photo)
    async with _GRAPH_LOCK:
        add_result = await cognee.add(text, dataset_name=DATASET, node_set=[f"photo:{photo.id}"])
        dataset_id = _extract_dataset_id(add_result)
        await cognee.cognify(datasets=[DATASET])
    return {"ok": True, "dataset_id": dataset_id}


async def weave_memory(photo_id: int) -> None:
    """Background task: build the graph for a freshly-uploaded photo and flip its
    status pending -> ready. Runs after the HTTP response so uploads feel instant."""
    from .db import SessionLocal
    from .models import Photo

    db = SessionLocal()
    try:
        photo = db.get(Photo, photo_id)
        if photo is None:
            return
        try:
            res = await remember_photo(photo)
            photo.cognee_dataset_id = res.get("dataset_id")
            photo.cognee_status = "ready"
        except Exception:  # noqa: BLE001
            photo.cognee_status = "failed"
        db.commit()
    finally:
        db.close()


def _mode_type(mode: str):
    """Map a UI mode to a Cognee SearchType (getattr-guarded across versions)."""
    g = SearchType.GRAPH_COMPLETION
    table = {
        "graph": g,
        "reason": getattr(SearchType, "GRAPH_COMPLETION_COT", g),  # chain-of-thought
        "summary": getattr(SearchType, "GRAPH_SUMMARY_COMPLETION", g),
        "rag": getattr(SearchType, "RAG_COMPLETION", g),
    }
    return table.get(mode, g)


async def recall_answer(query: str, top_k: int = 8, mode: str = "graph") -> dict:
    """recall(): answer a question by traversing the memory graph, and return the
    specific photos the answer connected (parsed from [PhotoID:n] markers).

    Records the Q&A in a rolling session and applies any accumulated feedback
    (feedback_influence) so the memory's answers improve as you rate them."""
    query_type = _mode_type(mode)
    results = await cognee.search(
        query_text=query,
        query_type=query_type,
        datasets=[DATASET],
        top_k=top_k,
        session_id=SESSION,
        feedback_influence=0.6,
    )
    answer = results[0] if results else ""
    if isinstance(answer, dict):
        answer = answer.get("search_result") or answer.get("answer") or str(answer)
    if isinstance(answer, list):
        answer = "\n".join(str(x) for x in answer)
    answer = str(answer or "")
    photo_ids = [int(m) for m in dict.fromkeys(_PHOTO_RE.findall(answer))]
    # Strip the internal markers before showing the answer to the user.
    clean = _PHOTO_RE.sub("", answer).replace("()", "").strip()
    clean = re.sub(r"\s{2,}", " ", clean)

    qa_id = None
    try:
        entries = await _get_session(SESSION, last_n=1)
        if entries:
            qa_id = entries[0].qa_id
    except Exception:  # noqa: BLE001
        pass
    return {
        "answer": clean, "photo_ids": photo_ids, "raw": answer,
        "session_id": SESSION, "qa_id": qa_id, "mode": mode,
    }


async def record_feedback(qa_id: str, score: int, text: str | None = None) -> dict:
    """Record 👍/👎 on an answer and fold it into the graph so future recall
    improves. score: 5 = good, 1 = bad (Cognee feedback_score is 1-5)."""
    ok = await _add_feedback(SESSION, qa_id, feedback_text=text, feedback_score=score)
    return {"ok": bool(ok)}


async def apply_feedback() -> dict:
    """Run improve() to fold accumulated session feedback into the graph weights."""
    async with _GRAPH_LOCK:
        await cognee.improve(dataset=DATASET, session_ids=[SESSION])
    return {"applied": True}


async def graph_counts() -> dict:
    """Current node/edge totals (used by /health and to show the graph growing)."""
    try:
        engine = await get_graph_engine()
        nodes, edges = await engine.get_graph_data()
        return {"nodes": len(nodes), "edges": len(edges)}
    except Exception as exc:  # brain may be empty before first ingest
        return {"nodes": 0, "edges": 0, "note": str(exc)[:120]}


def _attr(node: Any, key: str, default=None):
    """Read a property off a Cognee node regardless of shape.
    get_graph_data() yields nodes as (id, properties_dict) tuples."""
    if isinstance(node, (list, tuple)) and len(node) >= 2 and isinstance(node[1], dict):
        return node[0] if key == "id" else node[1].get(key, default)
    if isinstance(node, dict):
        return node.get(key, default)
    if hasattr(node, key):
        return getattr(node, key)
    props = getattr(node, "attributes", None) or getattr(node, "properties", None)
    if isinstance(props, dict):
        return props.get(key, default)
    return default


async def export_graph() -> dict:
    """The knowledge graph as {nodes, edges}, each node attributed to the photo
    it came from (via its belongs_to_set edge to a `photo:{id}` hub)."""
    engine = await get_graph_engine()
    raw_nodes, raw_edges = await engine.get_graph_data()

    # Map photo hub node-id -> photo id.
    hub_to_photo: dict[str, str] = {}
    for n in raw_nodes:
        name = str(_attr(n, "name", "") or _attr(n, "id", ""))
        if name.startswith("photo:"):
            hub_to_photo[str(_attr(n, "id"))] = name.split("photo:", 1)[1]

    source_of: dict[str, str] = {}
    edges_out = []
    for e in raw_edges:
        src, tgt = str(e[0]), str(e[1])
        rel = e[2] if len(e) > 2 else "related"
        if tgt in hub_to_photo:
            source_of[src] = hub_to_photo[tgt]
        edges_out.append({"source": src, "target": tgt, "rel": rel})

    nodes_out = []
    for n in raw_nodes:
        nid = str(_attr(n, "id"))
        name = str(_attr(n, "name", "") or "")
        ntype = str(_attr(n, "type", "Node"))
        if name.startswith("photo:"):
            pid = name.split("photo:", 1)[1]
            nodes_out.append({"id": nid, "label": f"📷 photo {pid}", "type": "Photo", "source": pid})
            continue
        label = name or ntype or nid[:8]
        nodes_out.append(
            {"id": nid, "label": label, "type": ntype, "source": source_of.get(nid, "shared")}
        )
    return {"nodes": nodes_out, "edges": edges_out}


_STRUCTURAL_TYPES = {"Photo", "DocumentChunk", "TextSummary", "TextDocument", "NodeSet", "Node"}


async def _concept_index() -> tuple[list[dict], dict]:
    """Build the concept index from the live graph.

    Returns (concepts, photo_to_concepts) where concepts is a list of
    {name, count, photoIds} grouped by entity name (robust to whether Cognee
    merges same-named entities across photos), sorted by how many memories
    mention each concept.
    """
    from collections import defaultdict

    engine = await get_graph_engine()
    raw_nodes, raw_edges = await engine.get_graph_data()

    info: dict[str, tuple[str, str]] = {}
    photo_hub: dict[str, str] = {}  # hub node id -> photo id
    for n in raw_nodes:
        nid = str(_attr(n, "id"))
        name = str(_attr(n, "name", "") or "")
        ntype = str(_attr(n, "type", "Node"))
        info[nid] = (name, ntype)
        if name.startswith("photo:"):
            photo_hub[nid] = name.split("photo:", 1)[1]

    # entity node id -> set of photo ids (via belongs_to_set edges to photo hubs)
    node_photos: dict[str, set] = defaultdict(set)
    for e in raw_edges:
        src, tgt = str(e[0]), str(e[1])
        if tgt in photo_hub:
            node_photos[src].add(photo_hub[tgt])

    concept_photos: dict[str, set] = defaultdict(set)
    for nid, (name, ntype) in info.items():
        if ntype == "Entity" and name and not name.startswith("photo:"):
            pids = node_photos.get(nid)
            if pids:
                concept_photos[name.strip().lower()].update(pids)

    concepts = [
        {"name": name, "count": len(pids),
         "photoIds": sorted(int(x) for x in pids if x.isdigit())}
        for name, pids in concept_photos.items() if pids
    ]
    concepts.sort(key=lambda c: (-c["count"], c["name"]))

    photo_to_concepts: dict[int, list[str]] = defaultdict(list)
    for c in concepts:
        for pid in c["photoIds"]:
            photo_to_concepts[pid].append(c["name"])
    return concepts, photo_to_concepts


async def get_concepts(limit: int = 40) -> list[dict]:
    """Top concepts Cognee extracted across all memories (for the Concept map)."""
    concepts, _ = await _concept_index()
    return concepts[:limit]


async def get_connections(photo_id: int, limit: int = 8) -> list[dict]:
    """Other photos connected to this one through shared concepts (graph traversal)."""
    concepts, _ = await _concept_index()
    from collections import defaultdict

    shared: dict[int, list[str]] = defaultdict(list)
    for c in concepts:
        if photo_id in c["photoIds"]:
            for pid in c["photoIds"]:
                if pid != photo_id:
                    shared[pid].append(c["name"])
    out = [{"photoId": pid, "shared": names, "count": len(names)} for pid, names in shared.items()]
    out.sort(key=lambda r: -r["count"])
    return out[:limit]


async def reminiscence_thread(start_id: int | None = None, length: int = 6) -> list[dict]:
    """Walk the knowledge graph to build a 'reminiscence thread' — a chain of
    memories where each is connected to the previous through a shared concept
    (a person, place, mood...). This is the graph's superpower: it can lead
    someone from one memory to a related one they'd forgotten. Returns an ordered
    list of {photo_id, shared:[concepts linking to the previous memory]}.
    """
    from collections import defaultdict

    concepts, photo_to_concepts = await _concept_index()
    if not photo_to_concepts:
        return []

    # adjacency: photo -> {neighbour_photo: [shared concept names]}
    adj: dict[int, dict[int, list[str]]] = defaultdict(lambda: defaultdict(list))
    for c in concepts:
        pids = c["photoIds"]
        for a in pids:
            for b in pids:
                if a != b:
                    adj[a][b].append(c["name"])

    # Start from the richest memory (most concepts) unless one is given.
    if start_id is None or start_id not in photo_to_concepts:
        start_id = max(photo_to_concepts, key=lambda p: len(photo_to_concepts[p]))

    thread = [{"photo_id": start_id, "shared": []}]
    visited = {start_id}
    current = start_id
    for _ in range(length - 1):
        nbrs = [(b, names) for b, names in adj[current].items() if b not in visited]
        if not nbrs:
            break
        # follow the strongest thread (most shared concepts)
        b, names = max(nbrs, key=lambda x: len(x[1]))
        thread.append({"photo_id": b, "shared": sorted(set(names))[:3]})
        visited.add(b)
        current = b
    return thread


async def forgotten_connection() -> dict | None:
    """Surface one surprising link: two memories that share several concepts but
    are otherwise unrelated — the kind of connection you'd never notice yourself."""
    concepts, photo_to_concepts = await _concept_index()
    from collections import defaultdict

    pair_shared: dict[tuple[int, int], list[str]] = defaultdict(list)
    for c in concepts:
        pids = sorted(c["photoIds"])
        for i in range(len(pids)):
            for j in range(i + 1, len(pids)):
                pair_shared[(pids[i], pids[j])].append(c["name"])
    if not pair_shared:
        return None
    # the pair with the most shared concepts is the most evocative "rhyme"
    (a, b), names = max(pair_shared.items(), key=lambda kv: len(kv[1]))
    if len(names) < 2:
        return None
    return {"a": a, "b": b, "shared": sorted(set(names))[:5]}


async def improve_memory() -> dict:
    """improve(): run Cognee's enrichment pass and report graph growth."""
    engine = await get_graph_engine()
    before_nodes, before_edges = await engine.get_graph_data()
    async with _GRAPH_LOCK:
        await cognee.improve(dataset=DATASET)
    after_nodes, after_edges = await engine.get_graph_data()
    return {
        "before": {"nodes": len(before_nodes), "edges": len(before_edges)},
        "after": {"nodes": len(after_nodes), "edges": len(after_edges)},
        "gained": {
            "nodes": len(after_nodes) - len(before_nodes),
            "edges": len(after_edges) - len(before_edges),
        },
    }


async def forget_photo(photo) -> dict:
    """forget(): remove a photo's memory from the graph.

    Wired fully in P3. Placeholder keeps the import surface stable for routers."""
    raise NotImplementedError("forget_photo is implemented in P3")
