import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ImportContacts } from "@/components/contacts/import-contacts";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listContactKeys } from "@/lib/data/contacts";

export const metadata: Metadata = { title: "Import contacts" };

export default function ImportContactsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/people"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        People
      </Link>
      <PageHeader
        title="Import contacts"
        description="Bring in people from your phone or address book, then choose who to keep."
      />
      <Suspense fallback={<ImportSkeleton />}>
        <ImportLoader />
      </Suspense>
    </div>
  );
}

async function ImportLoader() {
  const ctx = await requireUser();
  const existing = await listContactKeys(ctx);
  return <ImportContacts existing={existing} />;
}

function ImportSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
