"""Image storage — local filesystem for dev, Amazon S3 when S3_BUCKET is set."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

from .config import settings

# Local dev writes under the project; serverless (read-only FS) falls back to /tmp.
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(Path(__file__).resolve().parent.parent / "uploads")))
try:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    UPLOAD_DIR = Path("/tmp/reverie-uploads")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

try:
    import boto3

    _s3 = boto3.client("s3", region_name=settings.aws_region) if settings.s3_bucket else None
except Exception:  # noqa: BLE001
    _s3 = None


def save_image(data: bytes, ext: str = "jpg") -> tuple[str, str | None]:
    """Persist image bytes. Returns (public_url, s3_key|None)."""
    digest = hashlib.sha1(data).hexdigest()[:16]
    key = f"photos/{digest}.{ext}"

    if settings.s3_bucket and _s3 is not None:
        _s3.put_object(
            Bucket=settings.s3_bucket, Key=key, Body=data,
            ContentType=f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}",
        )
        url = f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"
        return url, key

    # Local fallback
    path = UPLOAD_DIR / f"{digest}.{ext}"
    path.write_bytes(data)
    return f"{settings.media_base_url}/media/{digest}.{ext}", None
