import { z } from "zod";
import { RELATIONSHIP_STRENGTHS } from "@/lib/constants";
import {
  optionalDate,
  optionalEmail,
  optionalLinkedIn,
  optionalPhone,
  optionalText,
  optionalUuid,
  occurredAt,
  requiredName,
} from "./fields";

/** Quick Add: only `name` is required. IDs are client-generated for idempotency. */
export const quickAddSchema = z.object({
  contactId: z.uuid(),
  interactionId: z.uuid(),
  name: requiredName,
  company: optionalText(200),
  jobTitle: optionalText(200),
  whereMet: optionalText(200),
  email: optionalEmail,
  phone: optionalPhone,
  otherContact: optionalText(500),
  linkedinUrl: optionalLinkedIn,
  notes: optionalText(20000),
  eventId: optionalUuid,
  occurredAt,
});
export type QuickAddInput = z.input<typeof quickAddSchema>;
export type QuickAddData = z.output<typeof quickAddSchema>;

export const contactUpdateSchema = z.object({
  name: requiredName,
  company: optionalText(200),
  jobTitle: optionalText(200),
  email: optionalEmail,
  phone: optionalPhone,
  otherContact: optionalText(500),
  linkedinUrl: optionalLinkedIn,
  whereMet: optionalText(200),
  firstMetOn: optionalDate,
  categoryId: optionalUuid,
  relationshipStrength: z.enum(RELATIONSHIP_STRENGTHS),
  generalNotes: optionalText(20000),
  nextFollowUpOn: optionalDate,
  nextAction: optionalText(500),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(30, "Up to 30 tags")
    .default([])
    .transform((tags) => dedupeTags(tags)),
});
export type ContactUpdateInput = z.input<typeof contactUpdateSchema>;
export type ContactUpdateData = z.output<typeof contactUpdateSchema>;

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

/** Map validated form data to DB column names. */
export function toContactColumns(d: ContactUpdateData) {
  return {
    name: d.name,
    company: d.company,
    job_title: d.jobTitle,
    email: d.email,
    phone: d.phone,
    other_contact: d.otherContact,
    linkedin_url: d.linkedinUrl,
    where_met: d.whereMet,
    ...(d.firstMetOn ? { first_met_at: `${d.firstMetOn}T12:00:00Z` } : {}),
    category_id: d.categoryId,
    relationship_strength: d.relationshipStrength,
    general_notes: d.generalNotes,
    next_follow_up_on: d.nextFollowUpOn,
    next_action: d.nextAction,
  };
}

/** Max contacts per import request; the client sends bigger imports in chunks. */
export const IMPORT_BATCH_SIZE = 200;

/** One row of a bulk import (phone contacts / vCard). */
export const importContactSchema = z.object({
  id: z.uuid(),
  name: requiredName,
  company: optionalText(200),
  jobTitle: optionalText(200),
  email: optionalEmail,
  phone: optionalPhone,
  otherContact: optionalText(500),
  linkedinUrl: optionalLinkedIn,
  generalNotes: optionalText(20000),
});
export type ImportContactInput = z.input<typeof importContactSchema>;

export const importContactsSchema = z
  .array(importContactSchema)
  .min(1, "Select at least one contact")
  .max(IMPORT_BATCH_SIZE, `Import at most ${IMPORT_BATCH_SIZE} contacts at a time`);
