import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EventList, NewEventButton } from "@/components/events/events-client";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listEvents } from "@/lib/data/events";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Events" description="Group the people you meet by where you met them." />
          <div className="space-y-2" aria-busy="true" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </>
      }
    >
      <EventsContent />
    </Suspense>
  );
}

async function EventsContent() {
  const ctx = await requireUser();
  const events = await listEvents(ctx);
  return (
    <>
      <PageHeader
        title="Events"
        description="Group the people you meet by where you met them."
        actions={<NewEventButton userId={ctx.userId} />}
      />
      <EventList events={events} userId={ctx.userId} />
    </>
  );
}
