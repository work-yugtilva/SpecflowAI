import Navbar from "@/components/Navbar";
import AetherFlowHero from "@/components/ui/aether-flow-hero";
import TrustedBand from "@/components/TrustedBand";
import ProductDiscoveryStrip from "@/components/ProductDiscoveryStrip";
import MeetSpecFlow from "@/components/MeetSpecFlow";
import Features from "@/components/Features";
import OutcomeStrip from "@/components/OutcomeStrip";
import Platform from "@/components/Platform";
import PricingSection from "@/components/PricingSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <AetherFlowHero />
      <TrustedBand />
      <ProductDiscoveryStrip />
      <MeetSpecFlow />
      <Features />
      <OutcomeStrip />
      <Platform />

      {/* Pricing */}
      <section
        id="pricing"
        style={{ background: "var(--bg)" }}
        className="py-28"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: "rgba(228,97,26,0.08)",
                color: "var(--orange)",
                border: "1px solid rgba(228,97,26,0.2)",
              }}
            >
              Pricing
            </div>
            <h2
              style={{
                fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: "var(--text)",
                marginBottom: "1rem",
              }}
            >
              Simple pricing,{" "}
              <span style={{ color: "var(--orange)", fontStyle: "italic" }}>no surprises</span>
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "1.0625rem", maxWidth: 480, margin: "0 auto" }}>
              Start free with 2 pipeline runs. Upgrade when you're ready to ship faster.
            </p>
          </div>
          <PricingSection />
        </div>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
