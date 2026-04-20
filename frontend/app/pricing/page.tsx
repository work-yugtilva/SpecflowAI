import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BillingPricingClient } from "./BillingPricingClient";

export const metadata = {
  title: "Pricing — SpecFlow",
  description:
    "Simple, transparent pricing for product managers. Start free, upgrade when you're ready.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      <Navbar />
      <section
        style={{ background: "#F8F4EF", minHeight: "calc(100vh - 60px)" }}
        className="pt-24 pb-32"
      >
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <div
              className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: "rgba(232,86,27,0.08)",
                color: "#E8561B",
                border: "1px solid rgba(232,86,27,0.2)",
              }}
            >
              Transparent pricing
            </div>
            <h1
              className="font-display mb-5"
              style={{
                fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif",
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "#0D0D0D",
              }}
            >
              Pay for what you{" "}
              <span style={{ color: "#E8561B", fontStyle: "italic" }}>actually use</span>
            </h1>
            <p
              className="max-w-xl mx-auto"
              style={{ color: "#6B6B6B", fontSize: "1.0625rem", lineHeight: 1.6 }}
            >
              Start free with two pipeline runs, then move into hosted Stripe billing
              when you need Pro or Team capacity.
            </p>
          </div>

          <BillingPricingClient isAuthenticated={Boolean(user)} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
