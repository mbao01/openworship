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
        <section
          style={{
            textAlign: "center",
            padding: "clamp(80px, 12vw, 160px) 0",
          }}
        >
          <div className="container">
            <blockquote
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(32px, 5vw, 64px)",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                maxWidth: "22ch",
                margin: "0 auto",
                fontWeight: 400,
              }}
            >
              Not a replacement for a media operator.
              <br />
              What makes the absence of one{" "}
              <em style={{ color: "var(--accent)", fontStyle: "italic" }}>
                not a problem.
              </em>
            </blockquote>
            <div
              style={{
                marginTop: "32px",
                fontFamily: "var(--mono)",
                fontSize: "11px",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
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
