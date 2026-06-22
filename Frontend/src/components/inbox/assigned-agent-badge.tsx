import { cn } from "@/lib/utils";

interface AssignedAgentBadgeProps {
  name: string;
  className?: string;
}

export function AssignedAgentBadge({
  name,
  className,
}: AssignedAgentBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[140px] items-center truncate rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
        className,
      )}
      title={name}
    >
      {name}
    </span>
  );
}
