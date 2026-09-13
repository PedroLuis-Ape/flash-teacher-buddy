import { ArrowRight, Gamepad2, Layers3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useFeaturedPublicResource } from "@/features/public-home/useFeaturedPublicResource";

const FALLBACK_PLAY_HREF = "/portal";

/**
 * Atividade publica real em destaque na Home.
 *
 * Nunca inventa conteudo: se a RPC responder `source: 'none'` a secao nao
 * aparece. Enquanto carrega, o CTA aponta para o catalogo publico.
 */
export function FeaturedPublicResource() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useFeaturedPublicResource();

  if (isError) return null;
  if (isPending) {
    return (
      <section className="landing-container landing-section" aria-busy="true">
        <div className="landing-featured landing-featured--skeleton" data-testid="featured-skeleton" />
      </section>
    );
  }
  if (!data || data.source === "none" || !data.list) return null;

  const list = data.list;
  const playHref = data.play_path ?? FALLBACK_PLAY_HREF;
  const samples = (data.samples ?? []).slice(0, 3);

  return (
    <section
      id="atividade-destacada"
      className="landing-container landing-section"
      aria-labelledby="featured-activity-heading"
      data-featured-source={data.source}
    >
      <div className="landing-featured">
        <div className="landing-featured-copy">
          <p className="landing-eyebrow">{t("publicLanding.featuredKicker")}</p>
          <h2 id="featured-activity-heading">{list.title}</h2>
          <p className="landing-featured-meta">
            {list.folder_title ? `${list.folder_title} · ` : ""}
            {t("publicLanding.cardCount", { count: list.card_count })} · {list.author_name}
          </p>
          {samples.length > 0 && (
            <ul className="landing-featured-samples">
              {samples.map((sample) => (
                <li key={sample.term}>
                  <span>{sample.term}</span>
                  <span aria-hidden="true">→</span>
                  <span>{sample.translation}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="landing-actions">
            <Link to={playHref} className="landing-primary">
              <Gamepad2 aria-hidden="true" className="mr-2 h-4 w-4" />
              {t("publicLanding.playNow")}
            </Link>
            <Link to="/portal" className="landing-text-link">
              {t("publicLanding.exploreMaterials")}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <p className="landing-note">{t("publicLanding.localProgressNote")}</p>
        </div>
        <div className="landing-featured-badge" aria-hidden="true">
          <Layers3 className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}
