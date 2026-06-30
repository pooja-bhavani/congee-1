"""Amazon Bedrock client — embeddings, vision captioning, and text generation.

Vision (Claude) turns a photo into a structured memory; Titan embeds the memory
text for pgvector search. Falls back to deterministic local behavior with no AWS
so the app always runs.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math

from .config import settings

try:
    import boto3
    from botocore.config import Config

    # Adaptive retries handle Bedrock on-demand throttling gracefully.
    _client = boto3.client(
        "bedrock-runtime",
        region_name=settings.aws_region,
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"},
                      read_timeout=60, connect_timeout=10),
    )
    BEDROCK_AVAILABLE = True
except Exception:  # noqa: BLE001
    _client = None
    BEDROCK_AVAILABLE = False


def _has_credentials() -> bool:
    if not BEDROCK_AVAILABLE or _client is None:
        return False
    try:
        return _client._request_signer._credentials is not None  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        return False


USE_BEDROCK = _has_credentials()


# --------------------------------------------------------------------------- #
# Embeddings
# --------------------------------------------------------------------------- #
def _local_embed(text: str) -> list[float]:
    dim = settings.embed_dim
    vec = [0.0] * dim
    for token in text.lower().split():
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        vec[h % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed(text: str) -> list[float]:
    if not USE_BEDROCK:
        return _local_embed(text)
    try:
        resp = _client.invoke_model(
            modelId=settings.bedrock_embed_model,
            body=json.dumps({"inputText": text, "dimensions": settings.embed_dim}),
        )
        return json.loads(resp["body"].read())["embedding"]
    except Exception:  # noqa: BLE001
        return _local_embed(text)


# --------------------------------------------------------------------------- #
# Vision — understand a photo
# --------------------------------------------------------------------------- #
_VISION_PROMPT = (
    "You are Engram, an AI that turns photos into warm, searchable memories. "
    "Look at this photo and return ONLY minified JSON: "
    '{"caption":"a warm, evocative one-sentence memory caption",'
    '"scene":"short scene description","mood":"2-3 mood words",'
    '"tags":["concrete","searchable","keywords"],'
    '"people":<integer count of people>,'
    '"palette":["#hex","#hex","#hex"]}'
)


def caption_image(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """Return a structured memory dict for an image."""
    if not USE_BEDROCK:
        return {
            "caption": "A captured moment.", "scene": "", "mood": "nostalgic",
            "tags": ["memory"], "people": 0, "palette": ["#C8775A", "#D9A86C", "#8A9A7B"],
        }
    b64 = base64.b64encode(image_bytes).decode()
    body = {
        "anthropic_version": "bedrock-2023-05-31", "max_tokens": 500,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": _VISION_PROMPT},
        ]}],
    }
    resp = _client.invoke_model(modelId=settings.bedrock_vision_model, body=json.dumps(body))
    raw = json.loads(resp["body"].read())["content"][0]["text"]
    import re
    match = re.search(r"\{.*\}", raw, re.S)
    data = json.loads(match.group(0)) if match else {}
    data.setdefault("caption", "A captured moment.")
    data.setdefault("tags", [])
    data.setdefault("palette", ["#C8775A", "#D9A86C", "#8A9A7B"])
    return data


def generate(system: str, user: str, max_tokens: int = 400) -> str:
    if not USE_BEDROCK:
        raise RuntimeError("bedrock-unavailable")
    body = {
        "anthropic_version": "bedrock-2023-05-31", "max_tokens": max_tokens,
        "system": system, "messages": [{"role": "user", "content": user}],
    }
    resp = _client.invoke_model(modelId=settings.bedrock_vision_model, body=json.dumps(body))
    return json.loads(resp["body"].read())["content"][0]["text"]
