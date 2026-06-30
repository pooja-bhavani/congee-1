"""Seed Engram with real sample memories.

Downloads a curated set of real photos, runs each through the live ingestion
pipeline (Bedrock vision caption + Titan embedding), and stores them with dates
spread across years so collections and 'on this day' are populated.

Run:  python -m app.seed
"""
from __future__ import annotations

import time
import urllib.request
from datetime import datetime

from .bedrock import USE_BEDROCK
from .db import Base, SessionLocal, engine, init_pgvector
from .ingest import ingest_photo
from .models import Photo

_U = "https://images.unsplash.com/photo-{}?w=1200&q=80"

# (unsplash_id, year, month, day) — varied life moments + dates near today (Jun 27)
SAMPLES = [
    ("1507525428034-b723cf961d3e", 2021, 6, 28),   # beach turquoise water
    ("1502209524164-acea936639a2", 2020, 6, 26),   # friends sunset silhouettes
    ("1469474968028-56623f02e42e", 2019, 8, 14),   # mountain valley light
    ("1414235077428-338989a2e8c0", 2022, 12, 24),  # dinner table friends
    ("1441974231531-c6227db76b6e", 2021, 10, 3),   # sunlit forest
    ("1490750967868-88aa4486c946", 2023, 5, 11),   # flower field
    ("1530103862676-de8c9debad1d", 2022, 6, 27),   # birthday celebration
    ("1543466835-00a7907e9de1", 2020, 9, 7),       # golden retriever dog
    ("1507003211169-0a1dd7228f2d", 2019, 6, 25),   # portrait warm light
    ("1469854523086-cc02fe5d8800", 2021, 7, 19),   # road trip desert highway
    ("1533105079780-92b9be482077", 2023, 1, 1),    # city night lights
    ("1504609773096-104ff2c73ba4", 2022, 4, 16),   # picnic park friends
    ("1518173946687-a4c8892bbd9f", 2020, 11, 22),  # cozy coffee window
    ("1523050854058-8df90110c9f1", 2019, 6, 29),   # graduation celebration
]


def run() -> None:
    init_pgvector()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    ok = 0
    try:
        for uid, y, m, d in SAMPLES:
            url = _U.format(uid)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Engram"})
                with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310
                    data = r.read()
                photo = ingest_photo(
                    db, data, owner="me", url=url,
                    taken_at=datetime(y, m, d),
                )
                ok += 1
                print(f"  ✓ {photo.caption[:60]}", flush=True)
                time.sleep(1.5)  # pace Bedrock to avoid throttling
            except Exception as e:  # noqa: BLE001
                print(f"  ✗ skipped {uid}: {str(e)[:90]}", flush=True)
        print(f"\n✓ Seeded {ok}/{len(SAMPLES)} memories")
        print(f"  vision+embeddings: {'Bedrock (live)' if USE_BEDROCK else 'local fallback'}")
        print(f"  db: {engine.url}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
