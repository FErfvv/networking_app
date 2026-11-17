import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddForm } from "@/components/quick-add/quick-add-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listEventOptions } from "@/lib/data/events";

export default function QuickAddPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Quick Add" description="Capture now, organize later." />
      <Suspense fallback={<QuickAddSkeleton />}>
        <QuickAddLoader />
      </Suspense>
    </div>
  );
}

async function QuickAddLoader() {
  const ctx = await requireUser();
  const events = await listEventOptions(ctx);
  return <QuickAddForm userId={ctx.userId} events={events} />;
}

function QuickAddSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-40 rounded-full" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
