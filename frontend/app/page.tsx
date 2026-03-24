import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PainStrip from "@/components/PainStrip";
import LogoBar from "@/components/LogoBar";
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
      <PainStrip />
      <LogoBar />
      <MeetSpecFlow />
      <Features />
      <OutcomeStrip />
      <Platform />
      <CTASection />
      <Footer />
    </main>
  );
}
