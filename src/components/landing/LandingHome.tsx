import { ArrowRight, BookOpen, GraduationCap, Layers3 } from "lucide-react";
import { Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { editorialMeta, getEditorialRouteLabel, type EditorialPageDefinition } from "@/content/public/editorialMaster";
import { FeaturedPublicResource } from "@/features/public-home/FeaturedPublicResource";
import { LandingMiniGame } from "@/features/public-home/LandingMiniGame";
import {
  MotionReveal,
  useHeroScrollMotion,
  useLandingPointerGlow,
  useLandingStoryProgress,
  useMagneticMotion,
  useReducedMotionPreference,
} from "@/features/public-home/LandingMotion";
import { MarketingCarousel } from "@/features/public-home/MarketingCarousel";
import { useFeaturedPublicResource } from "@/features/public-home/useFeaturedPublicResource";
import { usePointerTilt } from "@/hooks/usePointerTilt";
import "@/styles/landing-home.css";
import "@/styles/landing-mini-game.css";
import "@/styles/landing-featured.css";

export function LandingHome({ page }: { page: EditorialPageDefinition }) {
  const [steps, student, teacher, author, methodology] = page.sections;
  const demo = page.landingDemo;
  const { t } = useTranslation();
  const { data: featured } = useFeaturedPublicResource();
  const primaryHref = featured?.play_path ?? "/portal";
  const reducedMotion = useReducedMotionPreference();
  const landingRef = useLandingPointerGlow<HTMLDivElement>(reducedMotion);
  const heroRef = useHeroScrollMotion<HTMLElement>(reducedMotion);
  const demoTiltRef = usePointerTilt<HTMLDivElement>({ maxTilt: 4, disabled: reducedMotion });
  const magneticPrimaryRef = useMagneticMotion<HTMLAnchorElement>(reducedMotion, 7);
  const { ref: storyRef, activeStep } = useLandingStoryProgress<HTMLElement>(steps.items.length, reducedMotion);

  return (
    <div ref={landingRef} className="landing-home" data-reduced-motion={reducedMotion ? "true" : "false"}>
      <div className="landing-ambient" aria-hidden="true">
        <span className="landing-ambient-orb landing-ambient-orb-a" />
        <span className="landing-ambient-orb landing-ambient-orb-b" />
        <span className="landing-ambient-grid" />
      </div>

      <section ref={heroRef} className="landing-hero landing-container">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{page.audience}</p>
          <h1 className="text-foreground">
            <span className="landing-brand">APE — App Piteco: </span>
            {page.h1.replace("APE — App Piteco: ", "")}
          </h1>
          <p className="landing-lead">{page.intro[0]}</p>
          <div className="landing-actions">
            <Link
              ref={magneticPrimaryRef}
              to={primaryHref}
              className="landing-primary"
              data-cta="primary-play"
              data-magnetic="true"
            >
              <Gamepad2 aria-hidden="true" className="mr-2 h-4 w-4" />
              {t("publicLanding.playNow")}
            </Link>
            <Link to="/portal" className="landing-text-link" data-cta="secondary-explore">
              {t("publicLanding.exploreMaterials")}<ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/para-professores" className="landing-text-link" data-cta="tertiary-teacher">
              {t("publicLanding.forTeachers")}
            </Link>
          </div>
          <p className="landing-note">{t("publicLanding.localProgressNote")}</p>
        </div>

        {demo && (
          <div ref={demoTiltRef} className="landing-demo-wrap" data-landing-tilt="true">
            <span className="landing-demo-glint" aria-hidden="true" />
            <div className="landing-demo-top">
              <span className="landing-demo-dot" />
              <span>{demo.label}</span>
              <Layers3 aria-hidden="true" className="ml-auto h-4 w-4" />
            </div>
            <div className="landing-demo landing-demo-playable">
              <LandingMiniGame demo={demo} continueHref={primaryHref} locale={page.locale} />
            </div>
            <p className="landing-demo-caption">{demo.caption}</p>
          </div>
        )}
      </section>

      <MotionReveal className="landing-motion-featured" delay={30}>
        <FeaturedPublicResource />
      </MotionReveal>

      <section ref={storyRef} className="landing-steps-band landing-story-section" data-active-step={activeStep}>
        <div className="landing-container landing-section">
          <div className="landing-story-heading">
            <p className="landing-eyebrow">Como funciona</p>
            <h2>{steps.heading}</h2>
          </div>
          <div className="landing-story-layout">
            <ol className="landing-steps landing-story-steps">
              {steps.items.map((item, index) => {
                const split = item.indexOf(":");
                return (
                  <li key={item} className={activeStep === index ? "is-active" : undefined} data-story-step={index}>
                    <span className="landing-step-number">0{index + 1}</span>
                    <h3>{item.slice(0, split)}</h3>
                    <p>{item.slice(split + 1).trim()}</p>
                  </li>
                );
              })}
            </ol>

            <div className="landing-story-visual" aria-hidden="true" data-active-step={activeStep}>
              <div className="landing-story-orbit" />
              <div className="landing-story-stack">
                {steps.items.map((item, index) => {
                  const split = item.indexOf(":");
                  return (
                    <div key={`${item}-visual`} className={`landing-story-card landing-story-card-${index + 1}`}>
                      <span className="landing-story-card-number">0{index + 1}</span>
                      <strong>{item.slice(0, split)}</strong>
                      <span className="landing-story-card-line" />
                      <span className="landing-story-card-line landing-story-card-line-short" />
                    </div>
                  );
                })}
              </div>
              <div className="landing-story-meter">
                {steps.items.map((item, index) => (
                  <span key={`${item}-meter`} className={activeStep === index ? "is-active" : undefined} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <MotionReveal className="landing-motion-carousel" delay={40}>
        <MarketingCarousel />
      </MotionReveal>

      <div className="landing-container">
        <div className="landing-audiences landing-section">
          {[student, teacher].map((section, index) => {
            const Icon = index === 0 ? BookOpen : GraduationCap;
            return (
              <MotionReveal key={section.heading} className="landing-audience-reveal" delay={index * 90}>
                <section className="landing-audience">
                  <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map(text => <p key={text}>{text}</p>)}
                  <ul>{section.items.map(text => <li key={text}>{text}</li>)}</ul>
                  <Link className="landing-text-link" to={index === 0 ? "/portal" : "/para-professores"}>
                    {index === 0 ? "Encontrar um material" : "Conhecer os recursos para professores"}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </section>
              </MotionReveal>
            );
          })}
        </div>

        <MotionReveal className="landing-motion-trust" delay={30}>
          <div className="landing-trust landing-section">
            <section>
              <p className="landing-eyebrow">Por trás do Piteco</p>
              <h2>{author.heading}</h2>
              {author.paragraphs.map(text => <p key={text}>{text}</p>)}
              <a href={editorialMeta.preply.url} target="_blank" rel="noreferrer" className="landing-text-link">
                Conheça Pedro Luis na Preply<ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </section>
            <section>
              <h2>{methodology.heading}</h2>
              {methodology.paragraphs.map(text => <p key={text}>{text}</p>)}
              <Link className="landing-text-link" to="/pt-br/metodologia">
                Entenda a metodologia<ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </section>
          </div>
        </MotionReveal>

        <MotionReveal delay={20}>
          <section className="landing-faq landing-section" aria-labelledby="landing-faq-heading">
            <div><p className="landing-eyebrow">Antes de começar</p><h2 id="landing-faq-heading">Perguntas frequentes</h2></div>
            <div>
              {page.faq.map(faq => (
                <details key={faq.question}>
                  <summary>
                    <span>{faq.question}</span>
                    <span className="landing-faq-indicator" aria-hidden="true">+</span>
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </MotionReveal>

        <MotionReveal className="landing-motion-final" delay={30}>
          <section className="landing-final">
            <div><p className="landing-eyebrow">Seu próximo passo</p><h2>Escolha um conteúdo.<br />Comece a praticar.</h2></div>
            <AuthAwareCTA guestMode="signup" size="lg" className="landing-primary">
              {page.cta.primary}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </AuthAwareCTA>
          </section>
        </MotionReveal>

        <nav className="landing-resources" aria-label="Saiba mais sobre o APE">
          <Link to="/?guia=1">Guia de primeiros passos</Link>
          {page.relatedLinks.filter(link => link.href.startsWith("/")).map(link => <Link key={link.href} to={link.href}>{getEditorialRouteLabel(link.href, page.locale)}</Link>)}
          <a href="/extensao/index.html">Extensão de pronúncia e notas</a>
        </nav>
        <p className="landing-reviewed">Página revisada em {page.dateModified.split("-").reverse().join("/")}.</p>
      </div>
    </div>
  );
}
