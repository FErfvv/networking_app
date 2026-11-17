import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CalendarDays,
  ExternalLink,
  Link2 as Linkedin,
  Mail,
  MapPin,
  MessageSquareDashed,
  Pencil,
  Phone,
} from "lucide-react";
import { BackToPeople } from "@/components/contacts/back-to-people";
import { Avatar, CategoryBadge, StrengthIndicator } from "@/components/contacts/badges";
import { DeleteContactButton } from "@/components/contacts/delete-contact-button";
import { FollowUpChip } from "@/components/contacts/contact-list";
import { EmptyState } from "@/components/empty-state";
import { FollowUpControls } from "@/components/follow-ups/follow-up-controls";
import { InteractionTimeline } from "@/components/interactions/interaction-timeline";
import { LogInteractionButton } from "@/components/interactions/log-interaction-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getContactDetail } from "@/lib/data/contacts";
import { listEventOptions } from "@/lib/data/events";
import { formatDateOnly, formatTimestamp } from "@/lib/dates";
import { getUserToday } from "@/lib/tz";

export default function ContactPage({ params }: PageProps<"/people/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <BackToPeople />
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: { params: PageProps<"/people/[id]">["params"] }) {
  const { id } = await params;
  const ctx = await requireUser();
  const [detail, events, { today, tz }] = await Promise.all([
    getContactDetail(ctx, id),
    listEventOptions(ctx),
    getUserToday(),
  ]);
  if (!detail) notFound();
  const { contact: c, interactions, firstEvent } = detail;
  // Defense in depth: only ever render https links from stored data.
  const linkedinHref = c.linkedin_url?.startsWith("https://") ? c.linkedin_url : null;
  const telHref = c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <Avatar name={c.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{c.name}</h1>
          {c.job_title || c.company ? (
            <p className="text-muted-foreground">
              {[c.job_title, c.company].filter(Boolean).join(" at ")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CategoryBadge name={c.category_name} color={c.category_color} />
            <StrengthIndicator strength={c.relationship_strength} />
          </div>
        </div>
      </header>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <LogInteractionButton contactId={c.id} contactName={c.name} events={events} />
        {telHref ? (
          <Button asChild variant="outline" className="h-10">
            <a href={telHref}>
              <Phone />
              Call
            </a>
          </Button>
        ) : null}
        {c.email ? (
          <Button asChild variant="outline" className="h-10">
            <a href={`mailto:${c.email}`}>
              <Mail />
              Email
            </a>
          </Button>
        ) : null}
        {linkedinHref ? (
          <Button asChild variant="outline" className="h-10">
            <a href={linkedinHref} target="_blank" rel="noopener noreferrer">
              <Linkedin />
              LinkedIn
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="h-10">
          <Link href={`/people/${c.id}/edit`}>
            <Pencil />
            Edit
          </Link>
        </Button>
      </div>

      {/* Relationship / follow-up */}
      <section aria-labelledby="rel-heading" className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="rel-heading" className="text-sm font-medium text-muted-foreground">
              Next follow-up
            </h2>
            {c.next_follow_up_on ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatDateOnly(c.next_follow_up_on)}</span>
                <FollowUpChip date={c.next_follow_up_on} today={today} />
              </div>
            ) : (
              <p className="mt-1 text-sm">None scheduled</p>
            )}
            {c.next_action ? <p className="mt-1 text-sm">→ {c.next_action}</p> : null}
          </div>
          <FollowUpControls
            contactId={c.id}
            contactName={c.name}
            today={today}
            hasFollowUp={Boolean(c.next_follow_up_on)}
          />
        </div>
      </section>

      {/* Details */}
      <section aria-labelledby="details-heading">
        <h2 id="details-heading" className="mb-2 text-sm font-medium text-muted-foreground">
          Details
        </h2>
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <Detail label="Email">
            {c.email ? (
              <a href={`mailto:${c.email}`} className="break-all hover:underline">
                {c.email}
              </a>
            ) : null}
          </Detail>
          <Detail label="Phone">
            {telHref ? (
              <a href={telHref} className="hover:underline">
                {c.phone}
              </a>
            ) : null}
          </Detail>
          <Detail label="Other contact info">
            {c.other_contact ? <span className="break-words">{c.other_contact}</span> : null}
          </Detail>
          <Detail label="LinkedIn">
            {linkedinHref ? (
              <a
                href={linkedinHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all hover:underline"
              >
                {linkedinHref.replace(/^https?:\/\/(www\.)?/, "")}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : null}
          </Detail>
          <Detail label="Where we met">
            {c.where_met ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 text-muted-foreground" />
                {c.where_met}
              </span>
            ) : null}
          </Detail>
          <Detail label="First met">
            <span>{formatTimestamp(c.first_met_at, tz)}</span>
            {firstEvent ? (
              <Link
                href={`/events/${firstEvent.id}`}
                className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
              >
                <CalendarDays className="size-3.5" />
                {firstEvent.name}
              </Link>
            ) : null}
          </Detail>
          <Detail label="Tags" className="sm:col-span-2">
            {c.tag_names.length ? (
              <div className="flex flex-wrap gap-1.5">
                {c.tag_names.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Detail>
          <Detail label="General notes" className="sm:col-span-2">
            {c.general_notes ? (
              <p className="leading-relaxed whitespace-pre-wrap">{c.general_notes}</p>
            ) : null}
          </Detail>
        </dl>
      </section>

      {/* History */}
      <section aria-labelledby="history-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="history-heading" className="text-sm font-medium text-muted-foreground">
            Interaction history · {interactions.length}
          </h2>
          {interactions.length > 0 ? (
            <LogInteractionButton
              contactId={c.id}
              contactName={c.name}
              events={events}
              size="sm"
              label="Add"
            />
          ) : null}
        </div>
        {interactions.length ? (
          <div className="pl-3">
            <InteractionTimeline
              interactions={interactions}
              contactId={c.id}
              contactName={c.name}
              events={events}
              tz={tz}
            />
          </div>
        ) : (
          <EmptyState
            icon={MessageSquareDashed}
            title="No interactions yet"
            description="Log conversations, emails and coffee chats to build a history."
          />
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Added {formatTimestamp(c.created_at, tz)} · Updated {formatTimestamp(c.updated_at, tz)}
        </span>
        <DeleteContactButton contactId={c.id} name={c.name} redirectTo="/people" />
      </footer>
    </article>
  );
}

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
