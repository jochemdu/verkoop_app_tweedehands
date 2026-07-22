import { PageSkeleton } from "@/components/skeleton";

// Toont een skelet tijdens de server-fetch van elk app-scherm i.p.v. een
// lege flits. Next.js gebruikt dit automatisch als Suspense-fallback.
export default function AppLoading() {
  return (
    <main>
      <PageSkeleton />
    </main>
  );
}
