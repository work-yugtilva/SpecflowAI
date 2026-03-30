import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedBand from "@/components/TrustedBand";
import PainStrip from "@/components/PainStrip";

import MeetSpecFlow from "@/components/MeetSpecFlow";
import Features from "@/components/Features";
import OutcomeStrip from "@/components/OutcomeStrip";
import Platform from "@/components/Platform";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <TrustedBand />
      <PainStrip />

      <MeetSpecFlow />
      <Features />
      <OutcomeStrip />
      <Platform />
      <CTASection />
      <Footer />
    </main>
  );
}
