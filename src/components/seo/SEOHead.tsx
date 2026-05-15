import { Helmet } from "react-helmet-async";

/**
 * SEOHead — per-page metadata for public pages.
 *
 * Updates document.title, meta description, canonical, Open Graph and
 * Twitter Card tags. Falls back to whatever ships in index.html for any
 * tag not provided here.
 *
 * Social-preview crawlers (LinkedIn/Slack/Facebook) do NOT execute JS,
 * so they only see the static index.html head. Per-route values here are
 * for JS-executing crawlers (Googlebot) and runtime accuracy.
 *
 * To swap the default social image in the future, change SOCIAL_IMAGE
 * below — every public page that does not pass an explicit `image` will
 * pick it up automatically.
 */

const SITE_URL = "https://www.apeeducation.org";
// Default social preview image. Replace this URL with a dedicated 1200x630
// brand asset when one is available — no other code changes required.
const SOCIAL_IMAGE = `${SITE_URL}/branding/icon.png`;

export interface SEOHeadProps {
  title: string;
  description: string;
  /** Path starting with "/" — used for canonical and og:url. */
  path: string;
  image?: string;
  /** JSON-LD object(s) to inject as <script type="application/ld+json"> */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Override og:type (default: "website") */
  ogType?: string;
}

export function SEOHead({
  title,
  description,
  path,
  image = SOCIAL_IMAGE,
  jsonLd,
  ogType = "website",
}: SEOHeadProps) {
  const canonical = `${SITE_URL}${path}`;
  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="APE" />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(ld)}
        </script>
      ))}
    </Helmet>
  );
}