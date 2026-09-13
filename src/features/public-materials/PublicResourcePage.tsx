import { ArrowLeft, ArrowRight, BookOpen, Gamepad2, Layers3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { normalizeAppLocale } from "@/i18n/languages";
import { usePublicResource } from "@/features/public-materials/usePublicResource";

const MAX_SAMPLES = 8;

/**
 * Pagina canonica de um material publico curado.
 *
 * So renderiza conteudo quando a curadoria esta `approved` + `is_indexable` e
 * o material passa no quality gate do servidor. Nos demais casos a pagina e
 * honesta ("material nao disponivel") e sai do indice (canonical nulo).
 */
export default function PublicResourcePage() {
  const { t } = useTranslation();
  const { locale: rawLocale, slug } = useParams();
  // A URL publica usa minusculas (pt-br); o registro i18n usa pt-BR.
  const locale = normalizeAppLocale(rawLocale);
  const { data, isPending } = usePublicResource(locale ?? "", slug ?? "");

  const available = Boolean(locale && slug && data?.source === "editorial" && data.list);
  // O canonical espelha exatamente a URL pedida (locale em minusculas), para
  // nao divergir do endereco real quando o code do locale tem maiusculas.
  const canonicalPath = available ? `/${rawLocale}/material/${slug}` : null;

  if (!locale) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <SEOHead title={t("publicResource.notFoundTitle")} description={t("publicResource.notFoundBody")} path="/" canonicalPath={null} />
        <h1 className="text-2xl font-bold">{t("publicResource.notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("publicResource.notFoundBody")}</p>
        <Button asChild className="mt-6 w-auto"><Link to="/portal">{t("publicResource.explore")}</Link></Button>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16" aria-busy="true">
        <p className="text-muted-foreground">{t("publicResource.loading")}</p>
      </main>
    );
  }

  if (!available) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <SEOHead
          title={t("publicResource.notFoundTitle")}
          description={t("publicResource.notFoundBody")}
          path={`/${locale}/material/${slug}`}
          canonicalPath={null}
        />
        <Link to="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />{t("publicResource.backToPortal")}
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{t("publicResource.notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("publicResource.notFoundBody")}</p>
        <Button asChild className="mt-6 w-auto"><Link to="/portal">{t("publicResource.explore")}</Link></Button>
      </main>
    );
  }

  const list = data!.list!;
  const editorial = data!.editorial ?? { level: null, theme: null, resource_type: null, summary: null, reviewed_at: null };
  const samples = (data!.samples ?? []).slice(0, MAX_SAMPLES);
  const description = editorial.summary ?? t("publicResource.fallbackDescription", { title: list.title });
  const playHref = data!.play_path ?? "/portal";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <SEOHead
        title={`${list.title} — ${editorial.level ?? "Inglês"} | APE`}
        description={description}
        path={`/${locale}/material/${slug}`}
        canonicalPath={canonicalPath}
      />

      <Link to="/portal" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />{t("publicResource.backToPortal")}
      </Link>

      <header className="mt-5">
        {(editorial.theme || editorial.level) && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {[editorial.level, editorial.theme].filter(Boolean).join(" · ")}
          </p>
        )}
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{list.title}</h1>
        {list.folder_title && <p className="mt-2 text-muted-foreground">{list.folder_title}</p>}
        <p className="mt-4 text-base leading-relaxed">{description}</p>
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2"><dt>{t("publicResource.cards")}</dt><dd className="font-medium text-foreground">{list.card_count}</dd></div>
          <div className="flex gap-2"><dt>{t("publicResource.author")}</dt><dd className="font-medium text-foreground">{list.author_name}</dd></div>
          {editorial.resource_type && <div className="flex gap-2"><dt>{t("publicResource.type")}</dt><dd className="font-medium text-foreground">{editorial.resource_type}</dd></div>}
        </dl>
      </header>

      <section className="mt-8 flex flex-wrap gap-3" aria-label={t("publicResource.playNow")}>
        <Button asChild className="w-auto">
          <Link to={playHref}><Gamepad2 aria-hidden="true" className="mr-2 h-4 w-4" />{t("publicResource.playNow")}</Link>
        </Button>
        <Button asChild variant="outline" className="w-auto">
          <Link to="/portal">{t("publicResource.explore")}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>

      <p className="mt-3 text-sm text-muted-foreground">{t("publicResource.guestNote")}</p>

      {samples.length > 0 && (
        <section className="mt-10" aria-labelledby="resource-samples">
          <h2 id="resource-samples" className="text-xl font-bold">{t("publicResource.sampleHeading")}</h2>
          <ul className="mt-4 space-y-2">
            {samples.map((sample) => (
              <li key={`${sample.term}-${sample.translation}`} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{sample.term}</span>
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">{sample.translation}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
        <Layers3 aria-hidden="true" className="h-4 w-4" />
        <span>{t("publicResource.partOfApe")}</span>
      </footer>
    </main>
  );
}
