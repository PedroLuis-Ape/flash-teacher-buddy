import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { marketingScreenshots } from "@/features/public-home/marketingScreenshots";
import { trackProductEvent, trackProductEventOnce } from "@/lib/productEvents";

/**
 * Carrossel de prova visual da Home publica.
 *
 * Manual por padrao (sem autoplay), navegavel por teclado, com scroll-snap no
 * mobile. O texto de cada slide vive em HTML — nunca apenas na imagem.
 */
export function MarketingCarousel() {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLUListElement>(null);
  const slideIndexRef = useRef(0);

  useEffect(() => {
    void trackProductEventOnce(
      "carousel:view:home",
      "carousel_slide_view",
      { slide_index: 0 },
      { surface: "home" },
    );
  }, []);

  const scrollBySlide = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector("li");
    const step = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
    slideIndexRef.current = Math.max(0, slideIndexRef.current + direction);
    void trackProductEvent(
      "carousel_interaction",
      { slide_index: slideIndexRef.current, action: direction === 1 ? "next" : "previous" },
      { surface: "home" },
    );
  };

  return (
    <section
      className="landing-container landing-section"
      aria-labelledby="landing-carousel-heading"
      aria-roledescription="carousel"
      data-testid="marketing-carousel"
    >
      <div className="landing-carousel-head">
        <div>
          <p className="landing-eyebrow">{t("publicLanding.carousel.kicker")}</p>
          <h2 id="landing-carousel-heading">{t("publicLanding.carousel.heading")}</h2>
        </div>
        <div className="landing-carousel-controls">
          <button
            type="button"
            onClick={() => scrollBySlide(-1)}
            aria-label={t("publicLanding.carousel.previous")}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBySlide(1)}
            aria-label={t("publicLanding.carousel.next")}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul className="landing-carousel-track" ref={trackRef}>
        {marketingScreenshots.map((shot, index) => (
          <li key={shot.file} className="landing-carousel-slide">
            <img
              src={shot.file}
              width={shot.width}
              height={shot.height}
              alt={t(shot.altKey)}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            <p className="landing-carousel-caption">{t(shot.captionKey)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

