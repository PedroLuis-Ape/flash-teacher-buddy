export interface MarketingScreenshot {
  /** Arquivo em public/marketing/screenshots/. */
  file: string;
  width: number;
  height: number;
  /** Chave i18n da legenda visivel (o texto nunca vive so na imagem). */
  captionKey: string;
  /** Chave i18n do alt descritivo. */
  altKey: string;
}

const MOBILE = { width: 390, height: 844 } as const;

/**
 * Capturas reais do produto publico (sem dado privado).
 *
 * Regeneracao: script descrito no Segundo Cerebro; as imagens sao geradas a
 * partir das rotas publicas e nao contem dado pessoal.
 */
export const marketingScreenshots: MarketingScreenshot[] = [
  {
    file: "/marketing/screenshots/ape-catalogo-publico-mobile.webp",
    ...MOBILE,
    captionKey: "publicLanding.carousel.catalog",
    altKey: "publicLanding.carousel.catalogAlt",
  },
  {
    file: "/marketing/screenshots/ape-pasta-publica-mobile.webp",
    ...MOBILE,
    captionKey: "publicLanding.carousel.folder",
    altKey: "publicLanding.carousel.folderAlt",
  },
  {
    file: "/marketing/screenshots/ape-hub-de-jogos-mobile.webp",
    ...MOBILE,
    captionKey: "publicLanding.carousel.hub",
    altKey: "publicLanding.carousel.hubAlt",
  },
  {
    file: "/marketing/screenshots/ape-modo-de-estudo-mobile.webp",
    ...MOBILE,
    captionKey: "publicLanding.carousel.study",
    altKey: "publicLanding.carousel.studyAlt",
  },
];
