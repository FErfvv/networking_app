import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Import, SearchX, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactList } from "@/components/contacts/contact-list";
import { DirectoryFilters } from "@/components/contacts/directory-filters";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import {
  DIRECTORY_LIMIT,
  listCompanies,
  listContacts,
  parseDirectoryParams,
} from "@/lib/data/contacts";
import { getUserToday } from "@/lib/tz";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <>
      <PageHeader
        title="People"
        actions={
          <>
            <Button asChild variant="outline" className="h-9">
              <Link href="/people/import">
                <Import />
                Import
              </Link>
            </Button>
            <Button asChild variant="outline" className="hidden h-9 md:inline-flex">
              <Link href="/">
                <UserPlus />
                Quick add
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Directory({ searchParams }: { searchParams: PageProps<"/people">["searchParams"] }) {
  const ctx = await requireUser();
  const params = parseDirectoryParams(await searchParams);
  const [contacts, companies, { today, tz }] = await Promise.all([
    listContacts(ctx, params),
    listCompanies(ctx),
    getUserToday(),
  ]);
  const filtered = Boolean(params.q || params.category || params.company);

  return (
    <>
      <DirectoryFilters companies={companies} />
      {contacts.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description="Try a different search or clear the filters."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Meet someone? Add them in about ten seconds — or import from your contacts."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild className="h-10">
                  <Link href="/">
                    <UserPlus />
                    Quick add
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-10">
                  <Link href="/people/import">
                    <Import />
                    Import contacts
                  </Link>
                </Button>
              </div>
            }
          />
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
            {contacts.length} {contacts.length === 1 ? "person" : "people"}
            {contacts.length >= DIRECTORY_LIMIT ? ` (showing first ${DIRECTORY_LIMIT})` : ""}
          </p>
          <ContactList contacts={contacts} today={today} tz={tz} />
        </>
      )}
    </>
  );
}

function DirectorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
