from services.agents.base_agent import BaseAgent


class ProblemsAgent(BaseAgent):
    def __init__(self, config: dict):
        super().__init__("ProblemsAgent", config)

    def run(self, context, research, ingest):
        structured_context = {
            "product_context": context,
            "research": research,
            "ingest": ingest,
            "config": {
                "limit": self.config.get("limit"),
                "scoring": self.config.get("scoring"),
                "clustering": self.config.get("clustering", True)
            }
        }

        task = """
You are analyzing product inputs to identify real problems.

Step 1: Extract raw problems
- Identify pain points from inputs
- Ignore solutions
- Keep them specific

Step 2: Merge & Deduplicate
- Combine similar problems
- Remove noise
- Keep strongest signals

Step 3: Cluster Problems
- Group into themes (e.g., onboarding, checkout, retention)
- Assign a "cluster" field

Step 4: Score Problems (use config.scoring if provided)
For each problem:
- frequency (how often it appears)
- severity (how painful it is)
- confidence (quality of evidence)

If scoring rules exist:
- apply weights dynamically

Step 5: Prioritize
- Rank by score
- Apply limit if provided

Step 6: Attach Evidence
- Add sources (quotes, metrics, signals)

---

Return JSON:
[
  {
    "title": "...",
    "summary": "...",
    "cluster": "...",
    "frequency": 1-10,
    "severity": 1-10,
    "confidence": 1-10,
    "score": "...",
    "sources": ["..."]
  }
]
"""

        return self.execute(task, structured_context)