# LLM Drift Detection & Categorization Strategy

In your AI Ops Control Room, you are currently evaluating models using a suite of 6 datasets, with 5 granular metrics (Accuracy, Relevance, Factuality, Safety, Instruction Following) scoring from 0 to 100. 

To systematically calculate drift and identify the *type* of drift, we must separate the problem into three classic ML components: **Inputs**, **Outputs**, and **Performance metrics over time**.

---

## 1. Defining the Types of Drift

In LLM systems, drift generally falls into three main categories. Here is how you can identify each using your current dataset and evaluation structure:

### A. Performance Drift (Model Decay)
*What it is:* The structural degradation of the model's metrics over time. The model is getting objectively worse at the same tasks.
* **How to calculate:**
  * Track the rolling average (e.g., a 7-day or 30-day window) of your 5 core metrics (`Accuracy`, `Safety`, etc.).
  * Use a statistical threshold, such as the *Z-Score* or standard deviations away from the baseline. If `Accuracy` drops by more than $2\sigma$ from your baseline mean for two consecutive evaluations, trigger "Performance Drift".
* **Categorization:**
  * **Capability Drift:** E.g., `Accuracy` drops but `Relevance` remains high. The model understands what is asked but answers incorrectly.
  * **Alignment Drift:** E.g., `Safety` or `Instruction Following` drops, while `Accuracy` remains stable. The model is answering correctly but becoming more toxic or ignoring format constraints.

### B. Concept Drift (Semantic Drift in Outputs)
*What it is:* The prompt remains the same, but the model's *nature* of response changes drastically (e.g., after an underlying model weight update or API change).
* **How to calculate:**
  * Since you have `expected_output` and historical `actual_output`s, you can calculate the **Cosine Similarity** of embeddings between the model's current output and its typical output from exactly 3 weeks ago for the exact same `input`.
  * If the model's accuracy is stable, but its cosine similarity distance to historical baseline outputs widens abruptly, it indicates that the AI provider updated the model structure or alignment guardrails (e.g., answering "I cannot answer this" instead of giving a factual answer).

### C. Data / Input Drift (Covariate Shift) 
*What it is:* The context of what the users are *actually* asking the model in production diverges from what your golden dataset tests. (Note: Your dashboard currently tests static inputs, but going forward this applies to live traffic).
* **How to calculate:**
  * **Embedding Clustering:** Embed your production logs (live user prompts) and your golden dataset `input` strings. Use a metric like Population Stability Index (PSI) or MMD (Maximum Mean Discrepancy) between the two distributions.
  * If the live traffic embeddings drift far away from the golden `input` embeddings, trigger a "Data Drift" alert: "Your users are asking about X, but your golden dataset is only testing Y."

---

## 2. Proposed Implementation Strategies

### Strategy A: Statistical Thresholds on Existing Metrics (Easiest & Quickest)
Leverage the data you're already calculating. You don't need external ML tools for this, just simple time-series math in your `evaluations.py` route.

```python
# Pseudo-code idea for checking Performance Drift
def check_drift(recent_evaluations, historical_baseline):
    drift_alerts = []
    
    for metric in ['accuracy', 'factuality_score', 'toxicity_score']:
        baseline_avg = sum(historical_baseline[metric]) / len(historical_baseline)
        recent_avg = sum(recent_evaluations[metric]) / len(recent_evaluations)
        
        # If recent average drops by more than 15% relative to historical
        if recent_avg < (baseline_avg * 0.85):
            drift_alerts.append(f"Performance Drift Alert: {metric} degraded from {baseline_avg} to {recent_avg}")
            
    return drift_alerts
```

### Strategy B: "Judge of Judges" Semantic Router (Intermediate)
You currently have GPT-4o-mini evaluating the responses. You can add a *Drift Evaluator Prompt*.
Pass the `actual_output` from today and the `actual_output` from 30 days ago to the judge.
> "Here are two outputs from an AI responding to the same input 30 days apart. Output 1: [...]. Output 2: [...]. Has the underlying semantic tone, refusal rate, or verbosity significantly drifted? Score 0 to 100."

### Strategy C: Vector Database Integration (Advanced)
Store your `actual_output` and `input` strings inside a vector database (like Pinecone or ChromaDB). 
Periodically plot the centroid (middle point in vector space) of the past 100 outputs. If the centroid sharply shifts across a 24-hour period, flag a systemic Concept/Alignment Drift.

---

## 3. Recommended Next Steps for the AI Ops Dashboard

1. **Drift Alert Types:** Update your `models.py` `drift_triggered: Boolean` to `drift_type: String` (Accepting: `None`, `Model Decay`, `Alignment Shift`, `Data Drift`).
2. **Dynamic Baselines:** Allow the user in the UI to click a button that says *"Set as Golden Baseline"*. Future drift calculations will compare current scores against that specific, explicitly chosen baseline point rather than a moving average.
3. **Drift Root Cause Analysis Panel:** When a drift flag is thrown on the dashboard, show a component breaking down *why*. (e.g., "Safety score dropped by 23% in the last 48 hours for the AgentHarm dataset.")
