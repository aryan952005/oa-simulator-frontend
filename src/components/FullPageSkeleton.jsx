// Shown while a stored token is checked with E4 (FR4, FR22).
export default function FullPageSkeleton() {
  return (
    <div data-testid="startup-skeleton" aria-busy="true" aria-label="Loading" className="min-h-screen bg-surface">
      <div className="fixed left-0 top-0 h-full w-64 bg-surface-container-low p-space-lg flex flex-col gap-space-md">
        <div className="h-8 w-40 rounded-lg bg-surface-container-high animate-pulse" />
        <div className="h-10 rounded-lg bg-surface-container-high animate-pulse" />
        <div className="h-10 rounded-lg bg-surface-container-high animate-pulse" />
        <div className="h-10 rounded-lg bg-surface-container-high animate-pulse" />
      </div>
      <div className="pl-64">
        <div className="h-16 bg-surface" />
        <div className="p-space-lg flex flex-col gap-space-md">
          <div className="h-10 w-72 rounded-lg bg-surface-container-high animate-pulse" />
          <div className="h-40 rounded-xl bg-surface-container-high animate-pulse" />
        </div>
      </div>
    </div>
  );
}
