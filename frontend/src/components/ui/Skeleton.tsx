import clsx from "clsx";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "skeleton rounded-md",
        className
      )}
    />
  );
}

export function BookCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-cream p-4 space-y-3">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function BookDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-8">
        <Skeleton className="h-64 w-44 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={clsx("flex gap-3", i % 2 === 0 ? "justify-end" : "justify-start")}
        >
          <Skeleton
            className={clsx(
              "h-12 rounded-xl",
              i % 2 === 0 ? "w-2/3" : "w-3/4"
            )}
          />
        </div>
      ))}
    </div>
  );
}
