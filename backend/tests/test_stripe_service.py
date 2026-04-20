import os
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_123")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_123")
os.environ.setdefault("STRIPE_PRO_PRICE_ID", "price_pro_123")
os.environ.setdefault("STRIPE_TEAM_PRICE_ID", "price_team_123")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from fastapi import HTTPException

from services.stripe.stripe_service import StripeService


@pytest.mark.asyncio
async def test_create_or_get_customer_creates_and_persists_customer_when_missing():
    service = StripeService()

    with (
        patch.object(
            service,
            "_get_plan_row",
            AsyncMock(return_value={"user_id": "user-1", "plan": "free", "stripe_customer_id": None}),
        ),
        patch.object(service, "_get_user_email", AsyncMock(return_value="pm@example.com")),
        patch.object(service, "_update_plan_row", AsyncMock()) as update_row,
        patch("services.stripe.stripe_service.stripe.Customer.create", return_value=SimpleNamespace(id="cus_new")),
    ):
        customer_id = await service._create_or_get_customer("user-1")

    assert customer_id == "cus_new"
    update_row.assert_awaited_once_with("user-1", stripe_customer_id="cus_new")


@pytest.mark.asyncio
async def test_create_checkout_session_reuses_existing_customer():
    service = StripeService()

    with (
        patch.object(service, "_create_or_get_customer", AsyncMock(return_value="cus_existing")) as get_customer,
        patch(
            "services.stripe.stripe_service.stripe.checkout.Session.create",
            return_value=SimpleNamespace(url="https://stripe.test/checkout/session"),
        ) as checkout_create,
    ):
        url = await service.create_checkout_session(
            user_id="user-1",
            plan="pro",
            success_url="https://app.specflow.ai/dashboard?upgraded=true",
            cancel_url="https://app.specflow.ai/pricing",
        )

    assert url == "https://stripe.test/checkout/session"
    get_customer.assert_awaited_once_with("user-1")
    checkout_create.assert_called_once()
    _, kwargs = checkout_create.call_args
    assert kwargs["customer"] == "cus_existing"
    assert kwargs["line_items"] == [{"price": "price_pro_123", "quantity": 1}]
    assert kwargs["client_reference_id"] == "user-1"
    assert kwargs["metadata"] == {"user_id": "user-1", "plan": "pro"}
    assert kwargs["subscription_data"] == {"metadata": {"user_id": "user-1", "plan": "pro"}}


@pytest.mark.asyncio
async def test_create_customer_portal_session_requires_existing_customer():
    service = StripeService()

    with patch.object(
        service,
        "_get_plan_row",
        AsyncMock(return_value={"user_id": "user-1", "plan": "free", "stripe_customer_id": None}),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.create_customer_portal_session(
                user_id="user-1",
                return_url="https://app.specflow.ai/settings/billing",
            )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_handle_webhook_rejects_invalid_signature():
    service = StripeService()

    with patch(
        "services.stripe.stripe_service.stripe.Webhook.construct_event",
        side_effect=stripe.SignatureVerificationError("bad", "sig"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.handle_webhook(b"{}", "bad-signature")

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_handle_webhook_checkout_completed_updates_plan_and_resets_usage():
    service = StripeService()
    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {"user_id": "user-1", "plan": "team"},
                "client_reference_id": "user-1",
                "customer": "cus_123",
                "subscription": "sub_123",
            }
        },
    }

    with (
        patch("services.stripe.stripe_service.stripe.Webhook.construct_event", return_value=event),
        patch.object(service, "_update_plan_row", AsyncMock()) as update_row,
    ):
        result = await service.handle_webhook(b"{}", "sig")

    assert result == {"received": True}
    update_row.assert_awaited_once_with(
        "user-1",
        plan="team",
        stripe_customer_id="cus_123",
        stripe_subscription_id="sub_123",
        api_credit_used_cents=0,
        pipeline_runs_used=0,
        step_runs_used=0,
    )


@pytest.mark.asyncio
async def test_handle_webhook_subscription_updated_syncs_plan_from_price():
    service = StripeService()
    event = {
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_123",
                "customer": "cus_123",
                "items": {"data": [{"price": {"id": "price_team_123"}}]},
            }
        },
    }

    with (
        patch("services.stripe.stripe_service.stripe.Webhook.construct_event", return_value=event),
        patch.object(
            service,
            "_get_plan_row_by_subscription_or_customer",
            AsyncMock(return_value={"user_id": "user-1"}),
        ),
        patch.object(service, "_update_plan_row", AsyncMock()) as update_row,
    ):
        await service.handle_webhook(b"{}", "sig")

    update_row.assert_awaited_once_with(
        "user-1",
        plan="team",
        stripe_customer_id="cus_123",
        stripe_subscription_id="sub_123",
    )


@pytest.mark.asyncio
async def test_handle_webhook_subscription_deleted_downgrades_to_free():
    service = StripeService()
    event = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_123",
                "customer": "cus_123",
            }
        },
    }

    with (
        patch("services.stripe.stripe_service.stripe.Webhook.construct_event", return_value=event),
        patch.object(
            service,
            "_get_plan_row_by_subscription_or_customer",
            AsyncMock(return_value={"user_id": "user-1"}),
        ),
        patch.object(service, "_update_plan_row", AsyncMock()) as update_row,
    ):
        await service.handle_webhook(b"{}", "sig")

    update_row.assert_awaited_once_with(
        "user-1",
        plan="free",
        stripe_customer_id="cus_123",
        stripe_subscription_id=None,
        step_runs_used=0,
    )


@pytest.mark.asyncio
async def test_billing_checkout_route_requires_auth():
    from main import app

    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/billing/checkout", json={})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_billing_portal_route_requires_auth():
    from main import app

    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/billing/portal", json={})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_billing_webhook_route_accepts_raw_body_and_signature(client):
    with patch("main.StripeService") as service_cls:
        service = MagicMock()
        service.handle_webhook = AsyncMock(return_value={"received": True})
        service_cls.return_value = service

        response = await client.post(
            "/billing/webhook",
            content=b'{"id":"evt_123"}',
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "t=123,v1=testsig",
            },
        )

    assert response.status_code == 200
    service.handle_webhook.assert_awaited_once_with(
        b'{"id":"evt_123"}',
        "t=123,v1=testsig",
    )
