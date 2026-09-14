export const DEFAULT_FOLDER_EMOJI = "📁";
export const FOLDER_EMOJI_STORAGE_KEY = "piteco.folders.emoji";

type FolderEmojiStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function usableEmoji(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function resolveFolderEmoji(
  cloudEmoji: string | null | undefined,
  localEmoji: string | null | undefined,
): string {
  return usableEmoji(cloudEmoji) ?? usableEmoji(localEmoji) ?? DEFAULT_FOLDER_EMOJI;
}

export function readLocalEmoji(storage: FolderEmojiStorage | undefined): Record<string, string> {
  if (!storage) return {};

  try {
    const raw = storage.getItem(FOLDER_EMOJI_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([folderId, emoji]) => {
        const normalized = usableEmoji(typeof emoji === "string" ? emoji : null);
        return normalized ? [[folderId, normalized]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function persistLocalEmoji(
  storage: FolderEmojiStorage | undefined,
  folderId: string,
  emoji: string | null,
): void {
  if (!storage || !folderId) return;

  try {
    const emojis = readLocalEmoji(storage);
    const normalized = usableEmoji(emoji);

    if (normalized) emojis[folderId] = normalized;
    else delete emojis[folderId];

    if (Object.keys(emojis).length === 0) {
      storage.removeItem(FOLDER_EMOJI_STORAGE_KEY);
    } else {
      storage.setItem(FOLDER_EMOJI_STORAGE_KEY, JSON.stringify(emojis));
    }
  } catch {
    // Local preferences are best-effort when storage is unavailable or full.
  }
}

export interface FolderEmojiChoiceGroup {
  label: string;
  emojis: string[];
}

export const FOLDER_EMOJI_CHOICES: FolderEmojiChoiceGroup[] = [
  { label: "Estudo", emojis: ["📚", "✏️", "🎓", "🧠", "📝", "🔖"] },
  { label: "Idiomas", emojis: ["🌎", "🗣️", "💬", "🔤", "🇺🇸", "🇪🇸"] },
  { label: "Mídia", emojis: ["🎬", "🎵", "🎧", "🎨", "📖", "🎮"] },
  { label: "Trabalho", emojis: ["💼", "📊", "📈", "🧩", "🗂️", "⚙️"] },
  { label: "Natureza", emojis: ["🌱", "🌿", "🌊", "☀️", "🌙", "🌈"] },
  { label: "Ciências", emojis: ["🔬", "🧪", "➗", "📐", "🚀", "💻"] },
  { label: "Variados", emojis: ["⭐", "🔥", "💡", "🎯", "🏆", "❤️"] },
];
