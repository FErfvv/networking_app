import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Download, FileJson, FileSpreadsheet, Import } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" showSettings={false} />
      <div className="space-y-6">
        <Section title="Appearance">
          <ThemeToggle />
        </Section>

        <Section
          title="Import contacts"
          description="Add people from your phone's contacts or a vCard (.vcf) file. You choose who to import."
        >
          <Button asChild variant="outline" className="h-10">
            <Link href="/people/import">
              <Import />
              Import contacts
            </Link>
          </Button>
        </Section>

        <Section
          title="Export your data"
          description="Your data is yours. Download it any time — no lock-in."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ExportLink href="/api/export/contacts.csv" icon={FileSpreadsheet} label="Contacts (CSV)" />
            <ExportLink href="/api/export/interactions.csv" icon={FileSpreadsheet} label="Interaction history (CSV)" />
            <ExportLink href="/api/export/backup.json" icon={FileJson} label="Full backup (JSON)" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The CSVs open in Excel, Numbers or Google Sheets. The JSON backup nests every
            interaction under its contact and includes events and tags.
          </p>
        </Section>

        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <Account />
        </Suspense>

        <Section title="Install on iPhone">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open this site in Safari.</li>
            <li>Tap the Share button, then “Add to Home Screen”.</li>
            <li>Launch it from your Home Screen — it opens straight to Quick Add.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

async function Account() {
  const { email, userId } = await requireUser();
  return (
    <Section title="Account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate font-medium">{email ?? "Unknown"}</p>
        </div>
        <SignOutButton userId={userId} />
      </div>
    </Section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ExportLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Button asChild variant="outline" className="h-10 justify-start">
      {/* Plain <a download> so the browser downloads instead of client-navigating. */}
      <a href={href} download>
        <Icon />
        {label}
        <Download className="ml-auto opacity-50 sm:ml-1" />
      </a>
    </Button>
  );
}
