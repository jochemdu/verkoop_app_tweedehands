// Losse skeleton-blokjes voor laadstaten (gebruikt in loading.tsx per route).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

// Herbruikbare pagina-skelet: kop + stat-rij + grote kaart. Dekt dashboard,
// inventory en de meeste lijstschermen tijdens de server-fetch.
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-40" />
    </div>
  );
}
