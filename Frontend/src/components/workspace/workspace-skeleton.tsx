export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-e bg-sidebar lg:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b px-6">
          <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-muted" />
        </header>
        <main className="flex-1 space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border bg-card"
              />
            ))}
          </div>
          <div className="h-[min(72vh,820px)] animate-pulse rounded-2xl border bg-card" />
        </main>
      </div>
    </div>
  );
}
