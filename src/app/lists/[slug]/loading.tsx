export default function ListDetailLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        {/* List Header Skeleton */}
        <header className="mb-4 sm:mb-8">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse sm:h-9" />
              <div className="mt-2 h-4 w-96 max-w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="mt-2 h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
            </div>
            <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        </header>

        {/* Weight Summary Skeleton */}
        <div className="mb-4 sm:mb-8">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-4">
              <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Skeleton */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-6 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-6 w-6 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
              {/* Items */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className="flex items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3"
                  >
                    <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse shrink-0" />
                  </div>
                ))}
              </div>
              {/* Add Item Button */}
              <div className="border-t border-zinc-200 px-3 py-1.5 dark:border-zinc-800 sm:px-4 sm:py-2">
                <div className="h-8 w-full bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
