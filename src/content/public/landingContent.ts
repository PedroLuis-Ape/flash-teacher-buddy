import pagesConfig from "../../../config/public-seo-pages.json";

export interface LandingLink {
  href: string;
  label: string;
}

export interface LandingHomeContent {
  path: "/";
  title: string;
  description: string;
  h1: string;
  intro: string;
  eyebrow: string;
  dateModified: string;
  author: {
    name: string;
    role: string;
    text: string;
  };
  steps: Array<{ title: string; text: string }>;
  oneBase: { heading: string; text: string };
  audiences: Array<{ title: string; text: string; items: string[] }>;
  demo: {
    heading: string;
    intro: string;
    items: Array<{
      id: string;
      label: string;
      title: string;
      subtitle: string;
      lines: string[];
    }>;
  };
  methodology: {
    heading: string;
    text: string;
    links: LandingLink[];
  };
  faqs: Array<{ question: string; answer: string }>;
  links: LandingLink[];
}

const home = pagesConfig.find((page) => page.path === "/");

if (!home) {
  throw new Error("A fonte editorial da landing não contém a rota raiz.");
}

export const landingContent = home as unknown as LandingHomeContent;

export const landingFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: landingContent.faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};
