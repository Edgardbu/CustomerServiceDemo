"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/lib/types";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

const GRADIENTS: [string, string][] = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#6366f1"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#0ea5e9"],
  ["#14b8a6", "#6366f1"],
  ["#f43f5e", "#f59e0b"],
  ["#8b5cf6", "#d946ef"],
  ["#3b82f6", "#22d3ee"],
];

const INSTAGRAM_GRADIENT =
  "linear-gradient(45deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
} as const;

const DOT_COLORS: Record<Channel, string> = {
  whatsapp: "bg-emerald-500",
  web_chat: "bg-sky-500",
  email: "bg-violet-500",
  sms: "bg-amber-500",
  facebook: "bg-blue-500",
  instagram: "bg-pink-500",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface ContactAvatarProps {
  name: string;
  initials?: string;
  imageUrl?: string | null;
  channel?: Channel;
  size?: keyof typeof SIZES;
  showChannelDot?: boolean;
  ring?: boolean;
  className?: string;
}

export function ContactAvatar({
  name,
  initials: initialsProp,
  imageUrl,
  channel,
  size = "md",
  showChannelDot = false,
  ring = false,
  className,
}: ContactAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = initialsProp || getInitials(name) || "?";
  const useInstagram = channel === "instagram" && !imageUrl;
  const [from, to] = GRADIENTS[hashString(name) % GRADIENTS.length];
  const showImage = Boolean(imageUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const background = useInstagram
    ? INSTAGRAM_GRADIENT
    : `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className={cn(
            "rounded-full object-cover shadow-sm",
            SIZES[size],
            ring && "ring-2 ring-background",
          )}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full font-semibold text-white shadow-sm select-none",
            SIZES[size],
            ring && "ring-2 ring-background",
          )}
          style={{ background }}
        >
          {initials}
        </span>
      )}
      {showChannelDot && channel ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full ring-2 ring-card",
            DOT_COLORS[channel],
          )}
        />
      ) : null}
    </span>
  );
}
