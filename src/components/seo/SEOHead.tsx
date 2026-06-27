import { Helmet } from "react-helmet-async";

/**
 * SEOHead — per-page metadata for public pages.
 *
 * Runtime metadata is useful for JavaScript-capable crawlers and for browser
 * navigation. Important public routes should also be pre-rendered so crawlers
 * that do not execute JavaScript receive equivalent metadata and content.
 */
const SITE_URL = "https://www.apeeducation.org";
const SOCIAL_IMAGE = `${SITE_URL}/branding/icon.png`;
const DEFAULT_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

export interface SEOAlternate {
  hrefLang: string;
  href: string;
}

export interface SEOHeadProps {
  title: string;
  description: string;
  /** Path starting with "/" — used for canonical and og:url. */
  path: string;
  /**
   * Override the canonical path. Pass null for pages that must not emit a
   * canonical URL, such as a client-rendered not-found screen.
   */
  canonicalPath?: string | null;
  image?: string;
  imageAlt?: string;
  /** BCP 47 language tag used on the document and Open Graph locale. */
  language?: string;
  /** robots directive. Defaults to index/follow with unrestricted previews. */
  robots?: string;
  /** Alternate localized URLs for future international routes. */
  alternates?: SEOAlternate[];
  /** JSON-LD object(s) to inject as <script type="application/ld+json"> */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Override og:type (default: "website") */
  ogType?: string;
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${normalizePath(value)}`;
}

function serializeJsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function SEOHead({
  title,
  description,
  path,
  canonicalPath,
  image = SOCIAL_IMAGE,
  imageAlt = "APE — flashcards e estudo ativo",
  language = "pt-BR",
  robots = DEFAULT_ROBOTS,
  alternates = [],
  jsonLd,
  ogType = "website",
}: SEOHeadProps) {
  const resolvedCanonicalPath =
    canonicalPath === null ? null : normalizePath(canonicalPath ?? path);
  const canonical = resolvedCanonicalPath
    ? absoluteUrl(resolvedCanonicalPath)
    : null;
  const pageUrl = absoluteUrl(path);
  const socialImage = absoluteUrl(image);
  const ogLocale = language.replace("-", "_");
  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet htmlAttributes={{ lang: language }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      {canonical && <link rel="canonical" href={canonical} />}

      {alternates.map(({ hrefLang, href }) => (
        <link
          key={`${hrefLang}:${href}`}
          rel="alternate"
          hrefLang={hrefLang}
          href={absoluteUrl(href)}
        />
      ))}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical ?? pageUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="APE" />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {ldArray.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }}
        />
      ))}
    </Helmet>
  );
}
