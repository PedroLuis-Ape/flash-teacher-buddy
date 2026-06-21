export type GameModeVisualKey =
  | "flip"
  | "write"
  | "multiple"
  | "unscramble"
  | "mixed"
  | "pronunciation";

export interface GameModeVisual {
  emoji: string;
  emojiLabel: string;
  tileClass: string;
  cardClass: string;
}

export const GAME_MODE_VISUALS: Record<GameModeVisualKey, GameModeVisual> = {
  flip: {
    emoji: "\u{1F504}",
    emojiLabel: "setas girando",
    tileClass: "border-sky-400/35 bg-sky-500/20",
    cardClass: "border-sky-500/25 bg-card/95 hover:border-sky-400/55 hover:bg-sky-500/10",
  },
  write: {
    emoji: "\u{270D}\u{FE0F}",
    emojiLabel: "mao escrevendo",
    tileClass: "border-amber-400/35 bg-amber-500/20",
    cardClass: "border-amber-500/25 bg-card/95 hover:border-amber-400/55 hover:bg-amber-500/10",
  },
  multiple: {
    emoji: "\u{2705}",
    emojiLabel: "resposta correta",
    tileClass: "border-emerald-400/35 bg-emerald-500/20",
    cardClass: "border-emerald-500/25 bg-card/95 hover:border-emerald-400/55 hover:bg-emerald-500/10",
  },
  unscramble: {
    emoji: "\u{1F9E9}",
    emojiLabel: "peca de quebra-cabeca",
    tileClass: "border-violet-400/35 bg-violet-500/20",
    cardClass: "border-violet-500/25 bg-card/95 hover:border-violet-400/55 hover:bg-violet-500/10",
  },
  mixed: {
    emoji: "\u{1F3B2}",
    emojiLabel: "dado de jogo",
    tileClass: "border-fuchsia-400/35 bg-fuchsia-500/20",
    cardClass: "border-fuchsia-500/25 bg-card/95 hover:border-fuchsia-400/55 hover:bg-fuchsia-500/10",
  },
  pronunciation: {
    emoji: "\u{1F3A4}",
    emojiLabel: "microfone",
    tileClass: "border-orange-400/40 bg-orange-500/20",
    cardClass: "border-orange-500/30 bg-card/95 hover:border-orange-400/60 hover:bg-orange-500/10",
  },
};
