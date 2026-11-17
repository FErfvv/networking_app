"use server";

import * as contacts from "@/lib/services/contacts";
import type {
  ContactUpdateInput,
  ImportContactInput,
  QuickAddInput,
} from "@/lib/validation/contact";
import { withAuth } from "./with-auth";

export async function quickAddContactAction(input: QuickAddInput) {
  return withAuth((ctx) => contacts.quickAddContact(ctx, input));
}

export async function findSimilarContactsAction(q: string) {
  return withAuth((ctx) => contacts.findSimilarContacts(ctx, String(q ?? "")), {
    revalidate: false,
  });
}

export async function updateContactAction(contactId: string, input: ContactUpdateInput) {
  return withAuth((ctx) => contacts.updateContact(ctx, contactId, input));
}

export async function deleteContactAction(contactId: string) {
  return withAuth((ctx) => contacts.deleteContact(ctx, contactId));
}

export async function importContactsAction(input: ImportContactInput[]) {
  return withAuth((ctx) => contacts.importContacts(ctx, input));
}
