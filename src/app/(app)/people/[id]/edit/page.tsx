import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ContactForm } from "@/components/contacts/contact-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getContact, listTagNames } from "@/lib/data/contacts";
import { todayInZone } from "@/lib/dates";
import { getUserTimeZone } from "@/lib/tz";
import type { ContactOverviewRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Edit contact" };

export default function EditContactPage({ params }: PageProps<"/people/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <EditLoader params={params} />
      </Suspense>
    </div>
  );
}

async function EditLoader({ params }: { params: PageProps<"/people/[id]/edit">["params"] }) {
  const { id } = await params;
  const ctx = await requireUser();
  const [contact, tags, tz] = await Promise.all([
    getContact(ctx, id),
    listTagNames(ctx),
    getUserTimeZone(),
  ]);
  if (!contact) notFound();

  return (
    <>
      <Link
        href={`/people/${contact.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {contact.name}
      </Link>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Edit contact</h1>
      <ContactForm
        contact={contact as ContactOverviewRow}
        tagSuggestions={tags}
        firstMetOn={todayInZone(tz, new Date(contact.first_met_at))}
      />
    </>
  );
}
