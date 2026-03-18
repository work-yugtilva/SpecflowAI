import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LogoBar from "@/components/LogoBar";
import MeetSpecFlow from "@/components/MeetSpecFlow";
import Features from "@/components/Features";
import Platform from "@/components/Platform";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <LogoBar />
      <MeetSpecFlow />
      <Features />
      <Platform />
      <CTASection />
      <Footer />
    </main>
  );
}
