# services/plan/plan_service.py
#
# Enforces per-user plan limits for pipeline execution.
#
# Plans:
#   free      — max 2 full pipeline runs (no credit cap)
#   pro       — max $15.00 estimated API credit (~30 full runs)
#   team      — max $100.00 estimated API credit (~200 full runs)
#
# Cost estimation (approximate, based on claude-sonnet-4-5 pricing):
#   Full pipeline run (5 steps) ≈ $0.50  → 50 cents
#   Single step regeneration    ≈ $0.10  → 10 cents

from __future__ import annotations

from typing import Any
from fastapi import HTTPException

from services.db.supabase_client import get_supabase_client
from services.db.supabase_async import run_sync, rows_from_result

PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "max_runs": 2,
        "max_credit_cents": None,
        "label": "Free",
        "price_dollars": 0,
    },
    "pro": {
        "max_runs": None,
        "max_credit_cents": 1500,   # $15.00
        "label": "Pro",
        "price_dollars": 49,
    },
    "team": {
        "max_runs": None,
        "max_credit_cents": 10000,  # $100.00
        "label": "Team",
        "price_dollars": 99,
    },
}

# Estimated cost per operation in cents
COST_CENTS: dict[str, int] = {
    "full": 50,  # full 5-step pipeline run
    "step": 10,  # single step regeneration
}

# Free plan step budget: 2 full runs × 4 pipeline steps
# TODO: revert to 8 after testing
FREE_PLAN_STEP_LIMIT: int = 1000

_VALID_PLANS = set(PLAN_LIMITS.keys())


def _normalize_plan(plan: str | None) -> str:
    if plan == "unlimited":
        return "team"
    if plan in _VALID_PLANS:
        return str(plan)
    return "free"


class PlanService:
    """
    Service that checks and records pipeline usage against per-plan limits.
    Always uses the service-role Supabase client so it can upsert rows
    regardless of which user is making the request.
    """

    def __init__(self) -> None:
        self._client = get_supabase_client()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_user_plan(self, user_id: str) -> dict:
        """
        Fetch (or auto-create) the user's plan row and return enriched info.
        Safe to call without a prior row existing — will insert a free plan row.
        """
        row = await self._fetch_or_create(user_id)
        plan = _normalize_plan(row.get("plan"))
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        runs_used = row.get("pipeline_runs_used", 0)
        credit_used_cents = row.get("api_credit_used_cents", 0)

        result: dict[str, Any] = {
            "user_id": user_id,
            "plan": plan,
            "plan_label": limits["label"],
            "price_dollars": limits["price_dollars"],
            "pipeline_runs_used": runs_used,
            "api_credit_used_cents": credit_used_cents,
            "api_credit_used_dollars": round(credit_used_cents / 100, 2),
            "stripe_customer_id": row.get("stripe_customer_id"),
            "stripe_subscription_id": row.get("stripe_subscription_id"),
        }

        if plan == "free":
            max_runs = limits["max_runs"]
            steps_used = row.get("step_runs_used", 0)
            result["max_pipeline_runs"] = max_runs
            result["pipeline_runs_remaining"] = max(0, max_runs - runs_used)
            result["step_runs_used"] = steps_used
            result["step_runs_remaining"] = max(0, FREE_PLAN_STEP_LIMIT - steps_used)
            result["max_step_runs"] = FREE_PLAN_STEP_LIMIT
            result["limit_type"] = "runs"
        else:
            max_cents = limits["max_credit_cents"]
            result["max_credit_cents"] = max_cents
            result["max_credit_dollars"] = round(max_cents / 100, 2)
            result["credit_remaining_cents"] = max(0, max_cents - credit_used_cents)
            result["credit_remaining_dollars"] = round(
                max(0, max_cents - credit_used_cents) / 100, 2
            )
            result["limit_type"] = "credit"

        return result

    async def check_limit(self, user_id: str, is_full_run: bool) -> None:
        """
        Verify the user has not exceeded their plan limit.
        Raises HTTPException(429) with a human-readable message if the limit
        is reached. No-ops for paid plans that still have credit.
        """
        row = await self._fetch_or_create(user_id)
        plan = _normalize_plan(row.get("plan"))
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        if plan == "free":
            runs_used = row.get("pipeline_runs_used", 0)
            steps_used = row.get("step_runs_used", 0)
            max_runs = limits["max_runs"]

            if runs_used >= max_runs:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Free plan limit reached ({max_runs} full pipeline runs). "
                        "Upgrade to Pro at $49/month for $15 of AI credit."
                    ),
                )
            if steps_used >= FREE_PLAN_STEP_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Free plan step limit reached ({FREE_PLAN_STEP_LIMIT} steps). "
                        "Upgrade to Pro at $49/month for $15 of AI credit."
                    ),
                )
        else:
            # Pro / Team: check credit
            max_cents = limits["max_credit_cents"]
            if max_cents is None:
                return  # safety: no cap
            credit_used = row.get("api_credit_used_cents", 0)
            cost = COST_CENTS["full"] if is_full_run else COST_CENTS["step"]
            if credit_used + cost > max_cents:
                plan_label = limits["label"]
                max_dollars = max_cents / 100
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"{plan_label} plan credit limit reached (${max_dollars:.0f} of API credit). "
                        "Please upgrade your plan or wait for next billing cycle."
                    ),
                )

    async def record_usage(self, user_id: str, is_full_run: bool) -> None:
        """
        Increment usage counters after a successful pipeline run.
        For free plan: increments pipeline_runs_used (full runs only).
        For paid plans: increments api_credit_used_cents.
        """
        row = await self._fetch_or_create(user_id)
        plan = _normalize_plan(row.get("plan"))

        if plan == "free":
            if is_full_run:
                new_runs = row.get("pipeline_runs_used", 0) + 1
                new_steps = row.get("step_runs_used", 0) + 4  # 4 steps per full run
                def _update_runs():
                    return self._client.table("user_plans").update(
                        {"pipeline_runs_used": new_runs, "step_runs_used": new_steps, "updated_at": "now()"}
                    ).eq("user_id", user_id).execute()
                await run_sync(_update_runs)
            else:
                new_steps = row.get("step_runs_used", 0) + 1
                def _update_steps():
                    return self._client.table("user_plans").update(
                        {"step_runs_used": new_steps, "updated_at": "now()"}
                    ).eq("user_id", user_id).execute()
                await run_sync(_update_steps)
        else:
            cost = COST_CENTS["full"] if is_full_run else COST_CENTS["step"]
            new_credit = row.get("api_credit_used_cents", 0) + cost
            def _update_credit():
                return self._client.table("user_plans").update(
                    {"api_credit_used_cents": new_credit, "updated_at": "now()"}
                ).eq("user_id", user_id).execute()
            await run_sync(_update_credit)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_or_create(self, user_id: str) -> dict:
        """
        Fetch the user_plans row. If no row exists, insert a free plan row
        and return it. Uses upsert to avoid race conditions.
        """
        def _select():
            return (
                self._client.table("user_plans")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
        result = await run_sync(_select)
        rows = rows_from_result(result)
        if rows:
            return rows[0]

        # Auto-provision a free plan row on first access
        new_row = {"user_id": user_id, "plan": "free"}
        def _upsert():
            return (
                self._client.table("user_plans")
                .upsert(new_row, on_conflict="user_id")
                .execute()
            )
        upsert_result = await run_sync(_upsert)
        upserted = rows_from_result(upsert_result)
        if upserted:
            return upserted[0]
        return new_row
