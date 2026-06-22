export interface EmojiItem {
  id: string;
  native: string;
  name: string;
  keywords: string[];
  category: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  emojis: EmojiItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  people: "Smileys & People",
  nature: "Animals & Nature",
  foods: "Food & Drink",
  activity: "Activities",
  places: "Travel & Places",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
};

interface EmojiMartSkin {
  native: string;
}

interface EmojiMartEmoji {
  id: string;
  name: string;
  keywords?: string[];
  skins: EmojiMartSkin[];
}

interface EmojiMartData {
  categories: Array<{ id: string; emojis: string[] }>;
  emojis: Record<string, EmojiMartEmoji>;
}

let cache: EmojiCategory[] | null = null;
let loadPromise: Promise<EmojiCategory[]> | null = null;

function toEmojiItem(
  emoji: EmojiMartEmoji,
  category: string,
): EmojiItem | null {
  const native = emoji.skins[0]?.native;
  if (!native) return null;
  return {
    id: emoji.id,
    native,
    name: emoji.name,
    keywords: emoji.keywords ?? [],
    category,
  };
}

/** Lazy-load full emoji dataset from @emoji-mart/data (Unicode 14 native set). */
export async function loadEmojiCategories(): Promise<EmojiCategory[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = import("@emoji-mart/data/sets/14/native.json").then((mod) => {
    const data = (mod.default ?? mod) as EmojiMartData;
    const categories: EmojiCategory[] = data.categories.map((cat) => ({
      id: cat.id,
      label: CATEGORY_LABELS[cat.id] ?? cat.id,
      emojis: cat.emojis
        .map((id) => {
          const emoji = data.emojis[id];
          return emoji ? toEmojiItem(emoji, cat.id) : null;
        })
        .filter((item): item is EmojiItem => item != null),
    }));
    cache = categories;
    return categories;
  });

  return loadPromise;
}

export function searchEmojis(
  categories: EmojiCategory[],
  query: string,
): EmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: EmojiItem[] = [];
  for (const cat of categories) {
    for (const emoji of cat.emojis) {
      if (
        emoji.name.toLowerCase().includes(q) ||
        emoji.id.replace(/_/g, " ").includes(q) ||
        emoji.keywords.some((kw) => kw.toLowerCase().includes(q))
      ) {
        results.push(emoji);
      }
    }
  }
  return results;
}
