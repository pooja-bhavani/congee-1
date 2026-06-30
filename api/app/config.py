"""Engram configuration — environment driven."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./reverie.db"

    aws_region: str = "ap-south-1"
    bedrock_embed_model: str = "amazon.titan-embed-text-v2:0"
    bedrock_vision_model: str = "apac.anthropic.claude-3-5-sonnet-20241022-v2:0"
    embed_dim: int = 1024
    polly_voice: str = "Kajal"  # fallback neural voice for memory narration

    # ElevenLabs — genuinely human narration (primary when a key is set).
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str = "pqHfZKP75CvOlQylNhV4"  # "Bill" — wise, mature, grandfatherly
    elevenlabs_model: str = "eleven_multilingual_v2"  # highest-realism model

    # Storage: local filesystem for dev, S3 when s3_bucket is set.
    s3_bucket: str | None = None
    media_base_url: str = "http://localhost:8000"

    cors_origins: str = "*"

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgres")

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
