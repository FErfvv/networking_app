import type { Metadata } from "next";
import { Suspense } from "react";
import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/empty-state";
import { FollowUpSection, PeopleMiniList } from "@/components/follow-ups/follow-up-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { listEventOptions } from "@/lib/data/events";
import { UPCOMING_WINDOW_DAYS } from "@/lib/constants";
import { getUserToday } from "@/lib/tz";

export const metadata: Metadata = { title: "Follow-Ups" };

export default function FollowUpsPage() {
  return (
    <>
      <PageHeader title="Follow-Ups" description="Who should you reconnect with?" />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const ctx = await requireUser();
  const { today, tz } = await getUserToday();
  const [d, events] = await Promise.all([getDashboard(ctx, today), listEventOptions(ctx)]);
  const nothingDue = d.overdue.length + d.dueToday.length + d.upcoming.length === 0;

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {nothingDue ? (
          <EmptyState
            icon={PartyPopper}
            title="You're all caught up"
            description={`No follow-ups in the next ${UPCOMING_WINDOW_DAYS} days. Set one from any contact's profile.`}
          />
        ) : (
          <>
            <FollowUpSection title="Overdue" tone="danger" contacts={d.overdue} today={today} events={events} />
            <FollowUpSection
              title="Due today"
              tone="warning"
              contacts={d.dueToday}
              today={today}
              events={events}
              emptyText="Nothing due today."
            />
            <FollowUpSection
              title={`Upcoming · next ${UPCOMING_WINDOW_DAYS} days`}
              contacts={d.upcoming}
              today={today}
              events={events}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PeopleMiniList title="Recently added" contacts={d.recentlyAdded} field="created_at" tz={tz} />
        <PeopleMiniList
          title="Recently contacted"
          contacts={d.recentlyContacted}
          field="last_interaction_at"
          tz={tz}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
