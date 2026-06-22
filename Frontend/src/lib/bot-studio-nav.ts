import type { LucideIcon } from "lucide-react";
import { BookOpen, GitBranch, Sparkles } from "lucide-react";

export const BOT_STUDIO_BASE_PATH = "/bot-studio";

export interface BotStudioTab {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const BOT_STUDIO_TABS: BotStudioTab[] = [
  {
    id: "settings",
    label: "AI Settings",
    href: "/bot-studio/settings",
    icon: Sparkles,
    description: "Configure AI behavior, tone, and approval rules.",
  },
  {
    id: "knowledge",
    label: "Knowledge Base",
    href: "/bot-studio/knowledge",
    icon: BookOpen,
    description: "Store FAQs, menus, policies, and other factual content.",
  },
  {
    id: "flows",
    label: "Flow Builder",
    href: "/bot-studio/flows",
    icon: GitBranch,
    description: "Design conversation flows and bot decision paths.",
  },
];
