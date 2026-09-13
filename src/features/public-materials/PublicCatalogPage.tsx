import { useEffect, useState } from "react";
import { ChevronDown, Gamepad2, Layers3, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeAppLocale } from "@/i18n/languages";
import {
  type PublicResourceCatalogFacet,
  usePublicResourceCatalog,
} from "@/features/public-materials/usePublicResourceCatalog";

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 24;
const FILTER_NAMES = ["q", "level", "theme", "type"] as const;

interface FilterControlsProps {
  level: string;
  theme: string;
  type: string;
  levels: PublicResourceCatalogFacet[];
  themes: PublicResourceCatalogFacet[];
  resourceTypes: PublicResourceCatalogFacet[];
  onChange: (name: "level" | "theme" | "type", value: string) => void;
}

function FilterSelect({
  label,
  value,
  allLabel,
  facets,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  facets: PublicResourceCatalogFacet[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="text-sm">{label}</Label>
      <Select value={value || "all"} onValueChange={(next) => onChange(next === "all" ? "" : next)}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {facets.map((facet) => (
            <SelectItem key={facet.value} value={facet.value}>
              {facet.value} ({facet.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterControls({
  level,
  theme,
  type,
  levels,
  themes,
  resourceTypes,
  onChange,
}: FilterControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <FilterSelect
        label={t("publicCatalog.levelLabel")}
        value={level}
        allLabel={t("publicCatalog.allLevels")}
        facets={levels}
        onChange={(value) => onChange("level", value)}
      />
      <FilterSelect
        label={t("publicCatalog.themeLabel")}
        value={theme}
        allLabel={t("publicCatalog.allThemes")}
        facets={themes}
        onChange={(value) => onChange("theme", value)}
      />
      <FilterSelect
        label={t("publicCatalog.typeLabel")}
        value={type}
        allLabel={t("publicCatalog.allTypes")}
        facets={resourceTypes}
        onChange={(value) => onChange("type", value)}
      />
    </div>
  );
}

export default function PublicCatalogPage() {
  const { t } = useTranslation();
  const { locale: rawLocale } = useParams();
  const locale = normalizeAppLocale(rawLocale);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchString = searchParams.toString();
  const q = searchParams.get("q")?.trim() ?? "";
  const level = searchParams.get("level")?.trim() ?? "";
  const theme = searchParams.get("theme")?.trim() ?? "";
  const type = searchParams.get("type")?.trim() ?? "";
  const [searchValue, setSearchValue] = useState(q);

  const hasActiveFilters = Boolean(q || level || theme || type);
  const hasUrlFilters = FILTER_NAMES.some((name) => searchParams.has(name));
  const basePath = `/${rawLocale ?? "pt-br"}/materiais`;

  const { data, isPending, isError, refetch } = usePublicResourceCatalog({
    locale: locale ?? "",
    q,
    level,
    theme,
    type,
    limit: PAGE_SIZE,
    offset: 0,
  });

  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  useEffect(() => {
    if (searchValue.trim() === q) return;

    // Debounce de entrada e uma regra de UX, nao sincronizacao assíncrona.
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchString);
      const nextQuery = searchValue.trim();
      if (nextQuery) next.set("q", nextQuery);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [q, searchString, searchValue, setSearchParams]);

  const setFilter = (name: "level" | "theme" | "type", value: string) => {
    const next = new URLSearchParams(searchString);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchString);
    for (const name of FILTER_NAMES) next.delete(name);
    setSearchValue("");
    setSearchParams(next);
  };

  const filters = (
    <FilterControls
      level={level}
      theme={theme}
      type={type}
      levels={data?.facets.levels ?? []}
      themes={data?.facets.themes ?? []}
      resourceTypes={data?.facets.resource_types ?? []}
      onChange={setFilter}
    />
  );

  if (!locale) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <SEOHead
          title={t("publicCatalog.errorTitle")}
          description={t("publicCatalog.errorBody")}
          path={basePath}
          canonicalPath={null}
          robots="noindex, follow"
        />
        <h1 className="text-2xl font-bold">{t("publicCatalog.errorTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("publicCatalog.errorBody")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <SEOHead
        title={t("publicCatalog.seoTitle")}
        description={t("publicCatalog.seoDescription")}
        path={`${basePath}${searchString ? `?${searchString}` : ""}`}
        canonicalPath={basePath}
        robots={hasUrlFilters ? "noindex, follow" : undefined}
        language={locale}
      />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t("publicCatalog.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          {t("publicCatalog.title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t("publicCatalog.description")}
        </p>
      </header>

      <section className="mt-8" aria-labelledby="public-catalog-search-label">
        <Label id="public-catalog-search-label" htmlFor="public-catalog-search">
          {t("publicCatalog.searchLabel")}
        </Label>
        <div className="relative mt-2 max-w-2xl">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="public-catalog-search"
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("publicCatalog.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </section>

      <section className="mt-5" aria-label={t("publicCatalog.filtersLabel")}>
        <Collapsible className="md:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-auto" aria-label={t("publicCatalog.filterToggle")}>
              <SlidersHorizontal aria-hidden="true" />
              {t("publicCatalog.filterToggle")}
              <ChevronDown aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 rounded-xl border bg-card p-4">
            {filters}
          </CollapsibleContent>
        </Collapsible>
        <div className="hidden rounded-xl border bg-card p-4 md:block">{filters}</div>
      </section>

      {hasActiveFilters && (
        <div className="mt-4">
          <Button variant="ghost" size="sm" className="w-auto px-2" onClick={clearFilters}>
            {t("publicCatalog.clearFilters")}
          </Button>
        </div>
      )}

      {isPending && (
        <section className="mt-10" aria-busy="true" aria-live="polite">
          <p className="text-muted-foreground">{t("publicCatalog.loading")}</p>
        </section>
      )}

      {isError && (
        <section className="mt-10 rounded-xl border bg-card p-6" role="alert">
          <h2 className="text-xl font-bold">{t("publicCatalog.errorTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("publicCatalog.errorBody")}</p>
          <Button className="mt-5 w-auto" onClick={() => void refetch()}>
            {t("publicCatalog.retry")}
          </Button>
        </section>
      )}

      {!isPending && !isError && data?.total === 0 && !hasActiveFilters && (
        <section className="mt-10 rounded-xl border bg-card p-6" aria-live="polite">
          <h2 className="text-xl font-bold">{t("publicCatalog.emptyCurationTitle")}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {t("publicCatalog.emptyCurationBody")}
          </p>
        </section>
      )}

      {!isPending && !isError && data?.total === 0 && hasActiveFilters && (
        <section className="mt-10 rounded-xl border bg-card p-6" aria-live="polite">
          <h2 className="text-xl font-bold">{t("publicCatalog.emptyFilteredTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("publicCatalog.emptyFilteredBody")}</p>
          <Button variant="outline" className="mt-5 w-auto" onClick={clearFilters}>
            {t("publicCatalog.clearFilters")}
          </Button>
        </section>
      )}

      {!isPending && !isError && Boolean(data?.total) && (
        <section className="mt-10" aria-labelledby="public-catalog-results">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="public-catalog-results" className="text-xl font-bold">
              {t("publicCatalog.resultsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("publicCatalog.resultCount", { count: data?.total ?? 0 })}
            </p>
          </div>

          <ul className="mt-5 grid gap-4">
            {data?.items.map((item) => (
              <li key={item.slug}>
                <Card className="overflow-hidden">
                  <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
                    <div className="flex flex-wrap gap-2">
                      {item.level && <Badge variant="secondary">{item.level}</Badge>}
                      {item.theme && <Badge variant="outline">{item.theme}</Badge>}
                      {item.resource_type && <Badge variant="outline">{item.resource_type}</Badge>}
                    </div>
                    <CardTitle className="pt-2 text-xl leading-snug sm:text-2xl">
                      {item.canonical_path ? (
                        <Link to={item.canonical_path} className="hover:text-primary hover:underline">
                          {item.title}
                        </Link>
                      ) : item.title}
                    </CardTitle>
                    {item.folder_title && (
                      <p className="text-sm text-muted-foreground">{item.folder_title}</p>
                    )}
                  </CardHeader>
                  <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
                    {item.summary && <p className="leading-relaxed">{item.summary}</p>}
                    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Layers3 aria-hidden="true" className="h-4 w-4" />
                        <dt className="sr-only">{t("publicCatalog.cards")}</dt>
                        <dd>{t("publicCatalog.cardCount", { count: item.card_count })}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserRound aria-hidden="true" className="h-4 w-4" />
                        <dt className="sr-only">{t("publicCatalog.author")}</dt>
                        <dd>{item.author_name}</dd>
                      </div>
                    </dl>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 sm:p-6 sm:pt-0">
                    <Button asChild className="w-auto max-w-full">
                      <Link to={item.play_path}>
                        <Gamepad2 aria-hidden="true" />
                        {t("publicCatalog.playNow")}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
