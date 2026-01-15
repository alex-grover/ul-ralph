export default function HomeLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-2xl flex-col items-center gap-12 px-6 py-16 text-center">
        {/* Title Skeleton */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-80 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-6 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>

        {/* Button Skeleton */}
        <div className="h-12 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />

        {/* Features Skeleton */}
        <div className="grid gap-8 pt-8 sm:grid-cols-3 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
              <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
