"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateContactAction } from "@/lib/actions/contacts";
import {
  CATEGORY_LABELS,
  RELATIONSHIP_CATEGORIES,
  RELATIONSHIP_STRENGTHS,
  STRENGTH_LABELS,
  type RelationshipCategory,
  type RelationshipStrength,
} from "@/lib/constants";
import { contactUpdateSchema, type ContactUpdateInput } from "@/lib/validation/contact";
import { fieldErrorsOf } from "@/lib/validation/fields";
import type { ContactOverviewRow } from "@/lib/types/database";
import { TagInput } from "./tag-input";

export function ContactForm({
  contact,
  tagSuggestions,
  firstMetOn,
}: {
  contact: ContactOverviewRow;
  tagSuggestions: string[];
  /** first_met_at rendered as a local calendar date by the server. */
  firstMetOn: string;
}) {
  const router = useRouter();
  const [v, setV] = useState({
    name: contact.name,
    company: contact.company ?? "",
    jobTitle: contact.job_title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    otherContact: contact.other_contact ?? "",
    linkedinUrl: contact.linkedin_url ?? "",
    whereMet: contact.where_met ?? "",
    firstMetOn,
    relationshipCategory: contact.relationship_category as RelationshipCategory,
    relationshipStrength: contact.relationship_strength as RelationshipStrength,
    generalNotes: contact.general_notes ?? "",
    nextFollowUpOn: contact.next_follow_up_on ?? "",
    nextAction: contact.next_action ?? "",
  });
  const [tags, setTags] = useState<string[]>(contact.tag_names);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const set =
    (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const input: ContactUpdateInput = {
      ...v,
      // Only send firstMetOn if the user changed it, so we keep the exact original timestamp.
      firstMetOn: v.firstMetOn !== firstMetOn ? v.firstMetOn : null,
      tags,
    };
    const parsed = contactUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const fe = fieldErrorsOf(parsed.error);
      setErrors(fe);
      toast.error(Object.values(fe)[0] ?? "Please check the form.");
      return;
    }
    setPending(true);
    try {
      const res = await updateContactAction(contact.id, input);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success("Contact saved");
      router.push(`/people/${contact.id}`);
    } catch {
      toast.error("Network error — changes not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">Basic information</legend>
        <F label="Name" id="name" error={errors.name}>
          <Input id="name" value={v.name} onChange={set("name")} required maxLength={200} className="h-11" autoCapitalize="words" aria-invalid={Boolean(errors.name)} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Company" id="company" error={errors.company}>
            <Input id="company" value={v.company} onChange={set("company")} maxLength={200} className="h-11" autoComplete="organization" />
          </F>
          <F label="Job title" id="jobTitle" error={errors.jobTitle}>
            <Input id="jobTitle" value={v.jobTitle} onChange={set("jobTitle")} maxLength={200} className="h-11" autoComplete="organization-title" />
          </F>
          <F label="Email" id="email" error={errors.email}>
            <Input id="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={v.email} onChange={set("email")} className="h-11" aria-invalid={Boolean(errors.email)} />
          </F>
          <F label="Phone" id="phone" error={errors.phone}>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="off" value={v.phone} onChange={set("phone")} maxLength={50} className="h-11" aria-invalid={Boolean(errors.phone)} />
          </F>
          <F label="Other contact info" id="otherContact" error={errors.otherContact}>
            <Input id="otherContact" autoCapitalize="none" spellCheck={false} value={v.otherContact} onChange={set("otherContact")} maxLength={500} className="h-11" placeholder="Instagram, Discord, website…" aria-invalid={Boolean(errors.otherContact)} />
          </F>
          <F label="LinkedIn" id="linkedinUrl" error={errors.linkedinUrl}>
            <Input id="linkedinUrl" inputMode="url" autoCapitalize="none" spellCheck={false} value={v.linkedinUrl} onChange={set("linkedinUrl")} className="h-11" placeholder="linkedin.com/in/handle" aria-invalid={Boolean(errors.linkedinUrl)} />
          </F>
          <F label="Where we met" id="whereMet" error={errors.whereMet}>
            <Input id="whereMet" value={v.whereMet} onChange={set("whereMet")} maxLength={200} className="h-11" />
          </F>
          <F label="Date first met" id="firstMetOn" error={errors.firstMetOn}>
            <Input id="firstMetOn" type="date" value={v.firstMetOn} onChange={set("firstMetOn")} className="h-11" />
          </F>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">Relationship</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Category" id="category">
            <Select value={v.relationshipCategory} onValueChange={(x) => setV((s) => ({ ...s, relationshipCategory: x as RelationshipCategory }))}>
              <SelectTrigger id="category" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {RELATIONSHIP_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Strength" id="strength">
            <Select value={v.relationshipStrength} onValueChange={(x) => setV((s) => ({ ...s, relationshipStrength: x as RelationshipStrength }))}>
              <SelectTrigger id="strength" className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper">
                {RELATIONSHIP_STRENGTHS.map((c) => (
                  <SelectItem key={c} value={c}>{STRENGTH_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Next follow-up" id="nextFollowUpOn" error={errors.nextFollowUpOn}>
            <div className="flex gap-2">
              <Input id="nextFollowUpOn" type="date" value={v.nextFollowUpOn} onChange={set("nextFollowUpOn")} className="h-11" />
              {v.nextFollowUpOn ? (
                <Button type="button" variant="ghost" className="h-11" onClick={() => setV((s) => ({ ...s, nextFollowUpOn: "" }))}>
                  Clear
                </Button>
              ) : null}
            </div>
          </F>
          <F label="Next action" id="nextAction" error={errors.nextAction}>
            <Input id="nextAction" value={v.nextAction} onChange={set("nextAction")} maxLength={500} className="h-11" placeholder="e.g. Send resume, ask about referral" />
          </F>
        </div>
        <F label="Tags" id="tags" error={errors.tags}>
          <TagInput id="tags" value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </F>
        <F label="General notes" id="generalNotes" error={errors.generalNotes}>
          <Textarea id="generalNotes" rows={5} value={v.generalNotes} onChange={set("generalNotes")} maxLength={20000} className="min-h-28 text-base md:text-sm" placeholder="Background, interests, family, things to remember…" />
        </F>
      </fieldset>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 flex gap-2 bg-background/80 py-2 backdrop-blur md:bottom-0">
        <Button type="button" variant="outline" asChild className="h-11 flex-1 sm:flex-none">
          <Link href={`/people/${contact.id}`}>Cancel</Link>
        </Button>
        <Button type="submit" className="h-11 flex-[2] sm:flex-none sm:px-8" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function F({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
