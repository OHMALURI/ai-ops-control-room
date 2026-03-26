# Maintenance Runbook
ARTI-409-A | AI Ops Control Room

## If latency exceeds 2000ms
1. Check OpenAI API status at status.openai.com
2. Click Test Connection on the affected service
3. If consistently high, create an incident with severity=high
4. Schedule a maintenance window to investigate

## If quality score drops below 75%
1. Drift flag will appear automatically on dashboard
2. Click Run Evaluation to confirm the drop
3. Create an incident documenting the symptoms
4. Run troubleshooting checklist — check prompt change and model update boxes
5. Generate LLM summary and approve it
6. Create maintenance plan with rollback plan

## If PII detected in output
1. Policy check eval will fail immediately
2. Drift flag triggers
3. Create critical severity incident
4. Do NOT use real data — switch to synthetic data immediately
5. Review what data was submitted to OpenAI

## If critical incident created
1. Immediately run troubleshooting checklist
2. Generate incident summary and approve
3. Create maintenance plan with high risk level
4. Set next eval date to within 24 hours
5. Export compliance evidence for audit trail
```

---

## Step 5 — Final commit
```
cd C:\Users\Ohm\ai-ops-control-room
git add .
git commit -m "feat: Week 4 complete - auth, RBAC, audit log, governance, navbar, all pages"
git checkout main
git merge dev
git push origin main
git checkout dev
```

---

## Step 6 — Run tests one final time
```
cd backend
pytest tests/ -v