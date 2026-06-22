"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  loadEmojiCategories,
  searchEmojis,
  type EmojiCategory,
  type EmojiItem,
} from "@/lib/emoji-data";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({
  open,
  onClose,
  onSelect,
  className,
}: EmojiPickerProps) {
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("people");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveCategory("people");
    if (categories.length > 0) return;
    setLoading(true);
    loadEmojiCategories()
      .then((data) => {
        setCategories(data);
        setActiveCategory(data[0]?.id ?? "people");
      })
      .finally(() => setLoading(false));
  }, [open, categories.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const searchResults = useMemo(
    () => (query.trim() ? searchEmojis(categories, query) : []),
    [categories, query],
  );

  const visibleEmojis = useMemo(() => {
    if (query.trim()) return searchResults;
    return (
      categories.find((c) => c.id === activeCategory)?.emojis ?? []
    );
  }, [categories, activeCategory, query, searchResults]);

  if (!open) return null;

  function handleSelect(emoji: EmojiItem) {
    onSelect(emoji.native);
    onClose();
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "absolute bottom-11 start-0 z-50 flex w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl",
        className,
      )}
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji by name…"
            className="h-8 ps-8 text-xs"
          />
        </div>
      </div>

      {!query.trim() ? (
        <div className="flex flex-wrap gap-0.5 border-b border-border px-1.5 py-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              title={cat.label}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                activeCategory === cat.id
                  ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cat.label.split(" ")[0]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="scrollbar-subtle h-[280px] overflow-y-auto overflow-x-hidden p-2 pe-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : visibleEmojis.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {query.trim() ? "No emojis match your search" : "No emojis available"}
          </p>
        ) : (
          <>
            {query.trim() ? (
              <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {visibleEmojis.length} result{visibleEmojis.length === 1 ? "" : "s"}
              </p>
            ) : null}
            <div className="grid grid-cols-8 gap-0.5">
              {visibleEmojis.map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  title={emoji.name}
                  aria-label={emoji.name}
                  onClick={() => handleSelect(emoji)}
                  className="flex size-8 items-center justify-center rounded-md text-xl transition-colors hover:bg-muted"
                >
                  {emoji.native}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
