import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
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
      <Hero />
      <TrustedBand />
      <ProductDiscoveryStrip />
      <MeetSpecFlow />
      <Features />
      <OutcomeStrip />
      <Platform />

      {/* Pricing */}
      <section
        id="pricing"
        style={{ background: "#F8F4EF" }}
        className="py-28"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: "rgba(232,86,27,0.08)",
                color: "#E8561B",
                border: "1px solid rgba(232,86,27,0.2)",
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
                color: "#0D0D0D",
                marginBottom: "1rem",
              }}
            >
              Simple pricing,{" "}
              <span style={{ color: "#E8561B", fontStyle: "italic" }}>no surprises</span>
            </h2>
            <p style={{ color: "#6B6B6B", fontSize: "1.0625rem", maxWidth: 480, margin: "0 auto" }}>
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
