import { ArrowRight, BookOpen, GraduationCap, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthAwareCTA } from "@/components/auth/AuthAwareLink";
import { editorialMeta, getEditorialRouteLabel, type EditorialPageDefinition } from "@/content/public/editorialMaster";
import "@/styles/landing-home.css";

export function LandingHome({ page }: { page: EditorialPageDefinition }) {
  const [steps, student, teacher, author, methodology] = page.sections;
  const demo = page.landingDemo;
  return (
    <div className="landing-home">
      <section className="landing-hero landing-container">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{page.audience}</p>
          <h1 className="text-foreground">
            <span className="landing-brand">APE — App Piteco: </span>
            {page.h1.replace("APE — App Piteco: ", "")}
          </h1>
          <p className="landing-lead">{page.intro[0]}</p>
          <div className="landing-actions">
            <AuthAwareCTA guestMode="signup" size="lg" className="landing-primary">
              {page.cta.primary}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </AuthAwareCTA>
            <Link to="/portal" className="landing-text-link">{page.cta.secondary}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
          <p className="landing-note">Explore os materiais públicos antes de criar sua conta.</p>
        </div>
        {demo && (
          <div className="landing-demo-wrap">
            <div className="landing-demo-top"><span className="landing-demo-dot" /><span>{demo.label}</span><Layers3 aria-hidden="true" className="ml-auto h-4 w-4" /></div>
            <div className="landing-demo">
              <p className="landing-eyebrow">{demo.context}</p>
              <p className="landing-demo-prompt">{demo.prompt}</p>
              <p className="landing-note">{demo.instruction}</p>
              <details className="landing-demo-answer">
                <summary>{demo.answerLabel}</summary>
                <p>{demo.answer}</p>
              </details>
            </div>
            <p className="landing-demo-caption">{demo.caption}</p>
          </div>
        )}
      </section>

      <section className="landing-steps-band">
        <div className="landing-container landing-section">
          <p className="landing-eyebrow">Como funciona</p>
          <h2>{steps.heading}</h2>
          <ol className="landing-steps">
            {steps.items.map((item, index) => {
              const split = item.indexOf(":");
              return <li key={item}><span className="landing-step-number">0{index + 1}</span><h3>{item.slice(0, split)}</h3><p>{item.slice(split + 1).trim()}</p></li>;
            })}
          </ol>
        </div>
      </section>

      <div className="landing-container">
        <div className="landing-audiences landing-section">
          {[student, teacher].map((section, index) => {
            const Icon = index === 0 ? BookOpen : GraduationCap;
            return <section key={section.heading} className="landing-audience">
              <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
              <h2>{section.heading}</h2>
              {section.paragraphs.map(text => <p key={text}>{text}</p>)}
              <ul>{section.items.map(text => <li key={text}>{text}</li>)}</ul>
              <Link className="landing-text-link" to={index === 0 ? "/portal" : "/para-professores"}>{index === 0 ? "Encontrar um material" : "Conhecer os recursos para professores"}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            </section>;
          })}
        </div>
        <div className="landing-trust landing-section">
          <section>
            <p className="landing-eyebrow">Por trás do Piteco</p>
            <h2>{author.heading}</h2>
            {author.paragraphs.map(text => <p key={text}>{text}</p>)}
            <a href={editorialMeta.preply.url} target="_blank" rel="noreferrer" className="landing-text-link">Conheça Pedro Luis na Preply<ArrowRight aria-hidden="true" className="h-4 w-4" /></a>
          </section>
          <section>
            <h2>{methodology.heading}</h2>
            {methodology.paragraphs.map(text => <p key={text}>{text}</p>)}
            <Link className="landing-text-link" to="/pt-br/metodologia">Entenda a metodologia<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </section>
        </div>
        <section className="landing-faq landing-section" aria-labelledby="landing-faq-heading">
          <div><p className="landing-eyebrow">Antes de começar</p><h2 id="landing-faq-heading">Perguntas frequentes</h2></div>
          <div>{page.faq.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
        </section>
        <section className="landing-final">
          <div><p className="landing-eyebrow">Seu próximo passo</p><h2>Escolha um conteúdo.<br />Comece a praticar.</h2></div>
          <AuthAwareCTA guestMode="signup" size="lg" className="landing-primary">{page.cta.primary}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></AuthAwareCTA>
        </section>
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
