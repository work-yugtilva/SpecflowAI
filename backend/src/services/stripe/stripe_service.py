from __future__ import annotations

import logging
import os
from typing import Any, Literal, cast

import stripe
from fastapi import HTTPException

from services.config.load_env import load_root_env
from services.db.supabase_async import first_row_from_result, run_sync
from services.db.supabase_client import get_supabase_client

load_root_env()

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
stripe.api_version = "2026-02-25.clover"

StripePlan = Literal["pro", "team"]

STRIPE_PRICE_IDS: dict[str, str] = {}


def _load_price_ids() -> dict[str, str]:
    missing: list[str] = []
    pro_price_id = os.environ.get("STRIPE_PRO_PRICE_ID")
    team_price_id = os.environ.get("STRIPE_TEAM_PRICE_ID")
    if not pro_price_id:
        missing.append("STRIPE_PRO_PRICE_ID")
    if not team_price_id:
        missing.append("STRIPE_TEAM_PRICE_ID")
    if missing:
        raise RuntimeError(
            f"Missing required Stripe environment variables: {', '.join(missing)}"
        )
    return {
        "pro": pro_price_id,
        "team": team_price_id,
    }


class StripeService:
    def __init__(self) -> None:
        self._client = get_supabase_client()
        self._webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        self._price_ids = _load_price_ids()
        if not stripe.api_key:
            raise RuntimeError("Missing STRIPE_SECRET_KEY")
        if not self._webhook_secret:
            raise RuntimeError("Missing STRIPE_WEBHOOK_SECRET")

    async def create_checkout_session(
        self,
        user_id: str,
        plan: StripePlan,
        success_url: str,
        cancel_url: str,
    ) -> str:
        if plan not in self._price_ids:
            raise HTTPException(status_code=400, detail="Unsupported billing plan")

        customer_id = await self._create_or_get_customer(user_id)
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            client_reference_id=user_id,
            line_items=[{"price": self._price_ids[plan], "quantity": 1}],
            metadata={"user_id": user_id, "plan": plan},
            subscription_data={"metadata": {"user_id": user_id, "plan": plan}},
            success_url=success_url,
            cancel_url=cancel_url,
        )
        url = getattr(session, "url", None)
        if not url:
            raise HTTPException(status_code=502, detail="Stripe checkout session missing URL")
        return str(url)

    async def create_customer_portal_session(self, user_id: str, return_url: str) -> str:
        row = await self._get_plan_row(user_id)
        customer_id = row.get("stripe_customer_id")
        if not customer_id:
            raise HTTPException(status_code=400, detail="No billing account found")

        session = stripe.billing_portal.Session.create(
            customer=str(customer_id),
            return_url=return_url,
        )
        url = getattr(session, "url", None)
        if not url:
            raise HTTPException(status_code=502, detail="Stripe billing portal session missing URL")
        return str(url)

    async def handle_webhook(self, payload: bytes, sig_header: str) -> dict[str, bool]:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, self._webhook_secret)
        except (ValueError, stripe.SignatureVerificationError) as exc:
            raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature") from exc

        event_type = self._event_value(event, "type")
        event_object = cast(dict[str, Any], self._event_value(self._event_value(event, "data"), "object"))

        if event_type == "checkout.session.completed":
            metadata = event_object.get("metadata") or {}
            raw_plan = metadata.get("plan")
            plan = cast(StripePlan, raw_plan if raw_plan in self._price_ids else "pro")
            user_id = metadata.get("user_id") or event_object.get("client_reference_id")
            if user_id:
                await self._update_plan_row(
                    str(user_id),
                    plan=plan,
                    stripe_customer_id=event_object.get("customer"),
                    stripe_subscription_id=event_object.get("subscription"),
                    api_credit_used_cents=0,
                    pipeline_runs_used=0,
                    step_runs_used=0,
                )

        elif event_type == "customer.subscription.updated":
            price_id = self._subscription_price_id(event_object)
            plan = self._plan_from_price_id(price_id)
            if plan:
                row = await self._get_plan_row_by_subscription_or_customer(
                    subscription_id=self._event_value(event_object, "id"),
                    customer_id=event_object.get("customer"),
                )
                if row and row.get("user_id"):
                    await self._update_plan_row(
                        str(row["user_id"]),
                        plan=plan,
                        stripe_customer_id=event_object.get("customer"),
                        stripe_subscription_id=self._event_value(event_object, "id"),
                        payment_past_due=False,
                    )

        elif event_type == "customer.subscription.deleted":
            row = await self._get_plan_row_by_subscription_or_customer(
                subscription_id=self._event_value(event_object, "id"),
                customer_id=event_object.get("customer"),
            )
            if row and row.get("user_id"):
                await self._update_plan_row(
                    str(row["user_id"]),
                    plan="free",
                    stripe_customer_id=event_object.get("customer"),
                    stripe_subscription_id=None,
                    step_runs_used=0,
                )

        elif event_type == "invoice.payment_failed":
            row = await self._get_plan_row_by_subscription_or_customer(
                subscription_id=event_object.get("subscription"),
                customer_id=event_object.get("customer"),
            )
            if row and row.get("user_id"):
                await self._update_plan_row(
                    str(row["user_id"]),
                    payment_past_due=True,
                )

        elif event_type == "invoice.paid":
            # Only reset on subscription renewals, not the first invoice (covered by checkout.session.completed)
            billing_reason = event_object.get("billing_reason")
            if billing_reason == "subscription_cycle":
                customer_id = event_object.get("customer")
                row = await self._get_plan_row_by_subscription_or_customer(
                    subscription_id=event_object.get("subscription"),
                    customer_id=customer_id,
                )
                if row and row.get("user_id"):
                    await self._update_plan_row(
                        str(row["user_id"]),
                        api_credit_used_cents=0,
                    )

        return {"received": True}

    async def _get_plan_row(self, user_id: str) -> dict[str, Any]:
        def _select():
            return (
                self._client.table("user_plans")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        row = first_row_from_result(await run_sync(_select))
        if row:
            return row

        def _upsert():
            return (
                self._client.table("user_plans")
                .upsert({"user_id": user_id, "plan": "free"}, on_conflict="user_id")
                .execute()
            )

        row = first_row_from_result(await run_sync(_upsert))
        return row or {"user_id": user_id, "plan": "free"}

    async def _get_plan_row_by_subscription_or_customer(
        self,
        subscription_id: str | None,
        customer_id: str | None,
    ) -> dict[str, Any] | None:
        if subscription_id:
            def _by_subscription():
                return (
                    self._client.table("user_plans")
                    .select("*")
                    .eq("stripe_subscription_id", subscription_id)
                    .limit(1)
                    .execute()
                )

            row = first_row_from_result(await run_sync(_by_subscription))
            if row:
                return row

        if customer_id:
            def _by_customer():
                return (
                    self._client.table("user_plans")
                    .select("*")
                    .eq("stripe_customer_id", customer_id)
                    .limit(1)
                    .execute()
                )

            return first_row_from_result(await run_sync(_by_customer))

        return None

    async def _create_or_get_customer(self, user_id: str) -> str:
        row = await self._get_plan_row(user_id)
        existing_customer_id = row.get("stripe_customer_id")
        if existing_customer_id:
            return str(existing_customer_id)

        email = await self._get_user_email(user_id)
        kwargs: dict[str, Any] = {
            "metadata": {"user_id": user_id},
        }
        if email:
            kwargs["email"] = email

        customer = stripe.Customer.create(**kwargs)
        customer_id = str(getattr(customer, "id", ""))
        if not customer_id:
            raise HTTPException(status_code=502, detail="Stripe customer creation failed")

        await self._update_plan_row(user_id, stripe_customer_id=customer_id)
        return customer_id

    async def _get_user_email(self, user_id: str) -> str | None:
        def _fetch_user():
            return self._client.auth.admin.get_user_by_id(user_id)

        try:
            response = await run_sync(_fetch_user)
        except Exception:
            logger.exception("Failed to fetch user email for Stripe customer creation")
            return None

        user = getattr(response, "user", None)
        if user is None and isinstance(response, dict):
            user = response.get("user")

        email = getattr(user, "email", None)
        if email:
            return str(email)
        if isinstance(user, dict):
            raw_email = user.get("email")
            if raw_email:
                return str(raw_email)
        return None

    def _plan_from_price_id(self, price_id: str | None) -> StripePlan | None:
        if not price_id:
            return None
        for plan, mapped_price_id in self._price_ids.items():
            if mapped_price_id == price_id:
                return cast(StripePlan, plan)
        return None

    async def _update_plan_row(self, user_id: str, **fields: Any) -> dict[str, Any]:
        payload = {"user_id": user_id, **fields}

        def _upsert():
            return (
                self._client.table("user_plans")
                .upsert(payload, on_conflict="user_id")
                .execute()
            )

        row = first_row_from_result(await run_sync(_upsert))
        return row or payload

    def _subscription_price_id(self, subscription: dict[str, Any]) -> str | None:
        items = subscription.get("items") or {}
        data = items.get("data") or []
        if not data:
            return None
        price = data[0].get("price") or {}
        return cast(str | None, price.get("id"))

    def _event_value(self, obj: Any, key: str) -> Any:
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key)
