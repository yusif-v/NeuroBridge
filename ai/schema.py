"""Shape of the AI report the platform stores and renders. Keep keys stable — the UI reads them."""

AI_REPORT_FIELDS = {
    "summary": "One-paragraph plain-language explanation of the bug",
    "severity": "critical | high | medium | low (AI suggestion; the engine's severity stays separate)",
    "likely_root_cause": "Hypothesis — clearly not a verified fact",
    "recommended_fix": "Concrete suggestion for developers",
    "reproduction_steps": "list[str], cleaned-up steps",
    "confidence": "low | medium | high",
    "evidence_refs": "list[str] — exact log lines / screenshot captions the conclusion is based on",
    "insufficient_evidence": "bool — true if the evidence does not support a conclusion",
    "model": "model name used",
}

# JSON Schema version, handy for structured-output APIs.
AI_REPORT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
        "likely_root_cause": {"type": "string"},
        "recommended_fix": {"type": "string"},
        "reproduction_steps": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "evidence_refs": {"type": "array", "items": {"type": "string"}},
        "insufficient_evidence": {"type": "boolean"},
    },
    "required": ["summary", "severity", "likely_root_cause", "recommended_fix",
                 "reproduction_steps", "confidence", "evidence_refs", "insufficient_evidence"],
}
