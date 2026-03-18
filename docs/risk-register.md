# Model Risk Register
ARTI-409-A | AI Ops Control Room

## Risk 1 — Hallucination
The LLM may generate false or misleading incident summaries or root cause suggestions.
Mitigation: Human approval is required before any LLM output is saved to the database. The app never auto-saves LLM responses.

## Risk 2 — PII Leakage
A user could accidentally submit real customer or employee data to the OpenAI cloud API.
Mitigation: Data policy page warns users that no real data should be used. All test data is synthetic only. The policy check evaluation category detects PII patterns in LLM outputs.

## Risk 3 — Model Drift
LLM output quality may degrade over time without being detected.
Mitigation: Automated evaluation harness runs every 60 minutes and calculates a quality score. A drift flag triggers automatically when the score drops below the defined threshold.

## Risk 4 — Service Outage
The OpenAI API may become unavailable, breaking evaluation and incident summary features.
Mitigation: Test connection route shows live status of each service. All errors are caught and returned gracefully — the app never crashes on API failures.

## Risk 5 — Bias in Outputs
The LLM may produce biased root cause suggestions or incident analysis based on how prompts are worded.
Mitigation: All LLM outputs are assistive only. Humans must review and approve before anything is saved. No automated decisions are made by the LLM.