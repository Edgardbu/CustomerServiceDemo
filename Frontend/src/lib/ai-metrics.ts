const STORAGE_KEY = "ai_suggestions_today";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAiSuggestionsToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date: string; count: number };
    return parsed.date === todayKey() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export function incrementAiSuggestionsToday(): number {
  const next = getAiSuggestionsToday() + 1;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: todayKey(), count: next }),
  );
  return next;
}
