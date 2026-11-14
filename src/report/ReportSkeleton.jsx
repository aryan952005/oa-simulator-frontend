import Skeleton from '../components/Skeleton';

// FR22: the loading state is shaped like the report (header, summary row, headline, insights, table).
export default function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report" className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-space-md">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-6 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-28" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-44" />
      <Skeleton className="h-56" />
    </div>
  );
}
