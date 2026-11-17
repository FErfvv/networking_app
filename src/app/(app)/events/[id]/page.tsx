import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, MapPin, MessagesSquare, Users } from "lucide-react";
import { Avatar, CategoryBadge } from "@/components/contacts/badges";
import { EmptyState } from "@/components/empty-state";
import { EventDetailActions } from "@/components/events/event-detail-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getEventDetail } from "@/lib/data/events";
import { formatDateOnly, formatTimestamp } from "@/lib/dates";
import { INTERACTION_LABELS } from "@/lib/constants";
import { getUserTimeZone } from "@/lib/tz";

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Events
      </Link>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <EventContent params={params} />
      </Suspense>
    </div>
  );
}

async function EventContent({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const ctx = await requireUser();
  const [detail, tz] = await Promise.all([getEventDetail(ctx, id), getUserTimeZone()]);
  if (!detail) notFound();
  const { event, contacts, interactions } = detail;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" />
            {formatDateOnly(event.event_date)}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {event.location}
            </span>
          ) : null}
        </p>
        {event.description ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
        ) : null}
      </header>

      <EventDetailActions event={event} userId={ctx.userId} />

      <section aria-labelledby="met-heading" className="space-y-2">
        <h2 id="met-heading" className="text-sm font-semibold">
          People met here · {contacts.length}
        </h2>
        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one yet"
            description="Set this as the active event, then use Quick Add while you're there."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/people/${c.id}`}
                  className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <Avatar name={c.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.job_title, c.company].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <CategoryBadge category={c.relationship_category} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ix-heading" className="space-y-2">
        <h2 id="ix-heading" className="text-sm font-semibold">
          Interactions at this event · {interactions.length}
        </h2>
        {interactions.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No interactions logged" />
        ) : (
          <ul className="space-y-2">
            {interactions.map((i) => (
              <li key={i.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {i.contact ? (
                    <Link href={`/people/${i.contact.id}`} className="font-medium hover:underline">
                      {i.contact.name}
                    </Link>
                  ) : (
                    <span className="font-medium">Unknown contact</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {INTERACTION_LABELS[i.interaction_type]} · {formatTimestamp(i.occurred_at, tz, { time: true })}
                  </span>
                </div>
                {i.notes ? <p className="mt-1 text-sm whitespace-pre-wrap">{i.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
