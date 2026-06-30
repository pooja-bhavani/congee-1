"""Pydantic schemas."""
from __future__ import annotations

from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    owner: str = "me"
    limit: int = 24


class IngestUrlRequest(BaseModel):
    url: str
    owner: str = "me"


class FrameModeRequest(BaseModel):
    owner: str = "me"
    mode: str = "shuffle"
    query: str = ""


class AskRequest(BaseModel):
    question: str
    owner: str = "me"
    mode: str = "graph"  # graph | reason | insights | temporal


class RecallRequest(BaseModel):
    query: str
    owner: str = "me"
    mode: str = "graph"  # graph | reason | insights | temporal


class FeedbackRequest(BaseModel):
    qa_id: str
    score: int  # 5 = good, 1 = bad
    text: str | None = None


class ReelRequest(BaseModel):
    owner: str = "me"
    mode: str = "shuffle"
    query: str = ""
    limit: int = 8
