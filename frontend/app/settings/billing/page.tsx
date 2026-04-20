import { Sidebar } from "@/components/ui/sidebar";
import { BillingSettingsClient } from "./BillingSettingsClient";

export default function BillingPage() {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex items-center px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div
            className="flex items-center gap-1.5"
            style={{ fontSize: 13, color: "#6B6B6B" }}
          >
            <span>Settings</span>
            <span style={{ color: "#C0B8B0" }}>/</span>
            <span style={{ fontWeight: 500, color: "#0D0D0D" }}>Billing</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: "32px 40px" }}>
          <div style={{ maxWidth: 720 }}>
            <h1
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 400,
                marginBottom: 4,
                color: "#0D0D0D",
                letterSpacing: "-0.02em",
              }}
            >
              Billing
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: "#6B6B6B",
                marginBottom: 32,
                lineHeight: 1.5,
              }}
            >
              Review your active subscription, usage, and Stripe-managed billing settings.
            </p>
            <BillingSettingsClient />
          </div>
        </div>
      </div>
    </div>
  );
}
