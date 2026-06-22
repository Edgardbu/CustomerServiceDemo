import type { LucideIcon } from "lucide-react";
import { FlaskConical, Users } from "lucide-react";

export const SETTINGS_BASE_PATH = "/settings";

export interface SettingsTab {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "users",
    label: "Users",
    href: "/settings/users",
    icon: Users,
    description: "Manage team members, roles, and access for your workspace.",
  },
  {
    id: "demo-simulator",
    label: "Demo Simulator",
    href: "/settings/demo-simulator",
    icon: FlaskConical,
    description:
      "Pretend to be a customer on any channel and inject messages into the live pipeline.",
  },
];

export function getSettingsTab(pathname: string): SettingsTab | undefined {
  return SETTINGS_TABS.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
}
