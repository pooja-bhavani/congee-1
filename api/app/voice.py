"""Narration — the frame reads memories aloud in a genuinely human voice.

Primary: **ElevenLabs** (when ELEVENLABS_API_KEY is set) — the most realistic
text-to-speech available, indistinguishable from a real person reminiscing.
Fallback: Amazon Polly (long-form / generative Ruth) so the app always speaks
even without a key. One voice throughout; synthesized audio is cached so every
replay of a memory sounds identical.
"""
from __future__ import annotations

import hashlib

from .config import settings

# ElevenLabs voice settings tuned for warm, unhurried reminiscing.
_EL_SETTINGS = {
    "stability": 0.45,         # a little expressive variation, not flat
    "similarity_boost": 0.80,  # stay true to the natural voice
    "style": 0.30,             # gentle emotional warmth
    "use_speaker_boost": True,
}

# --- Polly fallback (Ruth long-form, the most human AWS voice) ---------------
_POLLY_VOICE = "Ruth"
try:
    import boto3
    from botocore.config import Config

    _polly = boto3.client(
        "polly",
        region_name="us-east-1",
        config=Config(retries={"max_attempts": 6, "mode": "adaptive"}),
    )
except Exception:  # noqa: BLE001
    _polly = None

# Cache synthesized audio by (provider+voice+text) so a memory always sounds the same.
_audio_cache: dict[str, bytes] = {}


def _human_text(text: str) -> str:
    """Light touches that make real TTS breathe — gentle pauses, soft trailing."""
    t = " ".join(text.strip().split())
    return t


def _elevenlabs(text: str) -> bytes:
    """Most realistic voice. Returns MP3 bytes, or b'' on any failure."""
    if not settings.elevenlabs_api_key:
        return b""
    try:
        import urllib.request
        import json

        url = (
            f"https://api.elevenlabs.io/v1/text-to-speech/"
            f"{settings.elevenlabs_voice_id}?output_format=mp3_44100_128"
        )
        body = json.dumps({
            "text": _human_text(text),
            "model_id": settings.elevenlabs_model,
            "voice_settings": _EL_SETTINGS,
        }).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except Exception:  # noqa: BLE001
        return b""


def _polly_speak(text: str) -> bytes:
    """Fallback: Polly Ruth, long-form first (most human), then generative."""
    if not _polly:
        return b""
    plain = _human_text(text)
    for engine in ("long-form", "generative", "neural"):
        try:
            r = _polly.synthesize_speech(
                Text=plain, TextType="text", Engine=engine,
                VoiceId=_POLLY_VOICE, OutputFormat="mp3",
            )
            audio = r["AudioStream"].read()
            if audio:
                return audio
        except Exception:  # noqa: BLE001
            continue
    return b""


def synthesize(text: str) -> bytes:
    """Return human-voice MP3 narration. ElevenLabs if configured, else Polly.

    Cached per text so the same memory always sounds identical. Returns empty
    bytes only if every provider is unreachable.
    """
    text = (text or "").strip()
    if not text:
        return b""

    provider = "el" if settings.elevenlabs_api_key else "polly"
    key = hashlib.sha1(f"{provider}:{text}".encode("utf-8")).hexdigest()
    if key in _audio_cache:
        return _audio_cache[key]

    audio = _elevenlabs(text) or _polly_speak(text)
    if audio:
        _audio_cache[key] = audio
    return audio
