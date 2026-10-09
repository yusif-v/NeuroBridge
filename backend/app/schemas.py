"""Request models. These ARE the engine -> platform contract (see docs/ENGINE_API.md)."""

from typing import Any, Literal

from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low"]
BugStatus = Literal["open", "ticketed", "fixed", "ignored"]
LogLevel = Literal["debug", "info", "warning", "error"]


class LogEntry(BaseModel):
    message: str
    level: LogLevel = "info"
    ts: str | None = Field(None, description="ISO timestamp; server time if omitted")
    data: dict[str, Any] | None = None


class Screenshot(BaseModel):
    data: str = Field(..., description="Base64-encoded image (data: URI prefix allowed)")
    mime: str = "image/png"
    caption: str | None = None


class RunStart(BaseModel):
    project: str
    build: str
    agent: str | None = Field(None, description="Name of the engine/bot doing the run")
    metadata: dict[str, Any] | None = None


class RunFinish(BaseModel):
    status: Literal["completed", "failed"] = "completed"
    summary: str | None = None
    stats: dict[str, Any] | None = Field(
        None, description="e.g. {tests_total, tests_passed, tests_failed, duration_s, actions}"
    )


class LogBatch(BaseModel):
    entries: list[LogEntry]


class BugReport(BaseModel):
    title: str
    description: str | None = None
    category: str | None = Field(None, description="crash | collision | ui | logic | perf | audio | ...")
    severity: Severity = "medium"
    fingerprint: str | None = Field(
        None, description="Stable id for dedup across runs; derived from title+category if omitted"
    )
    test_name: str | None = None
    agent: str | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    steps: list[str] = []
    expected: str | None = None
    actual: str | None = None
    metadata: dict[str, Any] | None = None
    logs: list[LogEntry] = []
    screenshots: list[Screenshot] = []


class RecheckReport(BaseModel):
    result: Literal["reproduced", "not_reproduced"]
    run_id: int | None = None
    attempts: int | None = None
    notes: str | None = None
    logs: list[LogEntry] = []
    screenshots: list[Screenshot] = []


class BugUpdate(BaseModel):
    status: BugStatus | None = None
    severity: Severity | None = None
