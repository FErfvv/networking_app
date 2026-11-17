import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-1 text-xl font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This page doesn&apos;t exist, or the contact was deleted.
      </p>
      <Button asChild className="mt-6 h-10">
        <Link href="/">Back to Quick Add</Link>
      </Button>
    </main>
  );
}
