import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/home/hero-section";
import { ProblemSection } from "@/components/home/problem-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { ModesSection } from "@/components/home/modes-section";
import { ContentTypesSection } from "@/components/home/content-types-section";
import { ServicePlanSection } from "@/components/home/service-plan-section";
import { ConsoleSection } from "@/components/home/console-section";
import { NumbersSection } from "@/components/home/numbers-section";
import { AudiencesSection } from "@/components/home/audiences-section";
import { CtaSection } from "@/components/home/cta-section";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <ModesSection />
        <ContentTypesSection />
        <ServicePlanSection />
        <ConsoleSection />
        <NumbersSection />
        <AudiencesSection />
        <section className="text-center p-[clamp(80px,12vw,160px)_0]">
          <div className="container">
            <blockquote className="font-serif text-[clamp(32px,5vw,64px)] leading-[1.1] tracking-[-0.025em] max-w-[22ch] m-auto my-0 font-normal">
              Not a replacement for a media operator.
              <br />
              What makes the absence of one{" "}
              <em className="text-accent font-italic">not a problem.</em>
            </blockquote>
            <div className="font-mono text-[11px] text-muted uppercase tracking-[0.12em] mt-8">
              openworship · PRD v2
            </div>
          </div>
        </section>
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
