"""Engram on Cognee — the memory frame that builds a knowledge graph of your life.

Self-hosted: kuzu (graph) + lancedb (vectors) + sqlite (photo metadata), with
AWS Bedrock Claude for reasoning and Bedrock Titan for embeddings. No cloud
Cognee, no external memory service — qualifies for the Open Source track.
"""
from __future__ import annotations

import os
from pathlib import Path

# --- Cognee configuration ---------------------------------------------------
# IMPORTANT: cognee's pydantic settings prioritize the dotenv file it discovers
# (the topoteretes/cognee clone's own .env, which pins Gemini + a shared brain)
# OVER process env vars. So os.environ can't reliably override those keys. The
# robust fix is cognee's programmatic config API, applied right after import —
# it mutates the cached config singletons and always wins. We force: an isolated
# self-hosted brain in this repo, AWS Bedrock Claude (LLM), and local fastembed
# (embeddings). Keys the clone .env does NOT set (auth/region) are fine via env.
ROOT = Path(__file__).resolve().parent.parent.parent  # congee-1/
BRAIN = ROOT / ".reverie_brain"
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")
os.environ.setdefault("REQUIRE_AUTHENTICATION", "False")
os.environ.setdefault("AWS_REGION", "ap-south-1")
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")
# litellm's bedrock embedding path signs with SigV4 and reads the region from
# AWS_REGION_NAME specifically (not AWS_REGION) — without it, aws_region_name is
# None and signing crashes ('NoneType'.split).
os.environ.setdefault("AWS_REGION_NAME", "ap-south-1")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / "api" / ".env")

import cognee  # noqa: E402


def _configure_store() -> None:
    """Select the memory store. Two options, one toggle (COGNEE_STORE):

    - 'postgres' — Cognee's *recommended production architecture* (Boss on the
      Cognee stream: "set up a FastAPI server using Postgres"). Graph + vectors +
      relational all live in Postgres/pgvector, which handles concurrent writes,
      so the single-writer lock is no longer a constraint. Uses PG* env vars.
    - 'local' (default) — fully self-hosted file DBs (kuzu + lancedb), no network,
      maximally demo-reliable.
    """
    if os.environ.get("COGNEE_STORE", "local").lower() == "postgres" and os.environ.get("PGHOST"):
        host = os.environ["PGHOST"]
        port = os.environ.get("PGPORT", "5432")
        name = os.environ.get("PGDATABASE", "postgres")
        user = os.environ.get("PGUSER", "")
        pw = os.environ.get("PGPASSWORD", "")
        cognee.config.set_relational_db_config({
            "db_provider": "postgres", "db_host": host, "db_port": port,
            "db_name": name, "db_username": user, "db_password": pw,
        })
        cognee.config.set_graph_db_config({"graph_database_provider": "postgres"})  # reuses the relational conn
        cognee.config.set_vector_db_config({
            "vector_db_provider": "pgvector", "vector_db_url": host, "vector_db_host": host,
            "vector_db_port": int(port), "vector_db_name": name,
            "vector_db_username": user, "vector_db_key": pw,
        })
    else:
        cognee.config.system_root_directory(str(BRAIN / "system"))  # cascades to db paths
        cognee.config.data_root_directory(str(BRAIN / "data"))
        cognee.config.set_vector_db_provider("lancedb")


def configure_cognee() -> None:
    """Pin store + providers authoritatively (beats the clone .env)."""
    _configure_store()
    # LLM -> AWS Bedrock Claude (free, ~/.aws default profile, ap-south-1).
    # CRUCIAL: clear any LLM_API_KEY the clone .env set (a Gemini key) — otherwise
    # the Bedrock adapter passes it as a bearer key and fails ("Invalid API Key
    # format"). Empty key => the adapter uses the AWS credential chain (~/.aws).
    cognee.config.set_llm_provider("bedrock")
    cognee.config.set_llm_model("apac.anthropic.claude-3-5-sonnet-20241022-v2:0")
    cognee.config.set_llm_api_key("")
    cognee.config.set_llm_endpoint("")
    # Embeddings -> AWS Bedrock Titan (free, proven in ap-south-1 by Engram's own
    # pipeline). Originally planned fastembed, but huggingface_hub's lazy import
    # breaks under Python 3.14 inside uvicorn; Titan is the reliable all-Bedrock
    # path. Clear the embedding API key for the same reason as the LLM key.
    cognee.config.set_embedding_provider("bedrock")
    # The embedding engine routes via raw litellm.aembedding (no explicit
    # custom_llm_provider), so the model MUST carry the "bedrock/" prefix.
    cognee.config.set_embedding_model("bedrock/amazon.titan-embed-text-v2:0")
    cognee.config.set_embedding_dimensions(1024)
    cognee.config.set_embedding_api_key("")  # clear the clone .env's Gemini key


configure_cognee()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from .bedrock import USE_BEDROCK  # noqa: E402
from .config import settings  # noqa: E402
from .db import Base, engine  # noqa: E402
from .routers import discover, memory, photos  # noqa: E402
from .storage import UPLOAD_DIR  # noqa: E402

app = FastAPI(title="Engram on Cognee — AI Memory Graph", version="1.0.0")

_origins = settings.cors_list
_allow_all = "*" in _origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")


@app.get("/")
def root() -> dict:
    return {
        "name": "Engram on Cognee",
        "memory": "self-hosted Cognee (kuzu graph + lancedb vectors)",
        "llm": "AWS Bedrock Claude" if USE_BEDROCK else "local-fallback",
        "embeddings": "AWS Bedrock Titan",
        "docs": "/docs",
    }


@app.get("/health")
async def health() -> dict:
    from .cognee_memory import graph_counts

    counts = await graph_counts()
    return {"status": "ok", **counts}


app.include_router(photos.router)
app.include_router(discover.router)
app.include_router(memory.router)
