interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div className="relative my-2 flex items-center justify-center">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border/60" aria-hidden />
      <span className="relative rounded-full border border-border bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}
