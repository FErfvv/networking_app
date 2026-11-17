"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDirectoryHref } from "@/lib/directory-query";

/** "← People" link that returns to the directory with the user's last sort/filters. */
export function BackToPeople() {
  const href = useDirectoryHref();
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      People
    </Link>
  );
}
