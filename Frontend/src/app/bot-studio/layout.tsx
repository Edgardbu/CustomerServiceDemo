import { BotStudioLayoutClient } from "@/components/bot-studio/bot-studio-layout-client";

export default function BotStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BotStudioLayoutClient>{children}</BotStudioLayoutClient>;
}
