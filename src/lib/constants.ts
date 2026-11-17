/** Colors a category can use. Must match the check constraint on public.categories. */
export const CATEGORY_COLORS = [
  "slate",
  "sky",
  "blue",
  "violet",
  "pink",
  "rose",
  "orange",
  "amber",
  "emerald",
  "teal",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Upper bound on categories per user, to keep pickers usable. */
export const MAX_CATEGORIES = 50;

/** Directory filter value for contacts without a category. */
export const NO_CATEGORY = "none";

export const RELATIONSHIP_STRENGTHS = [
  "new",
  "acquaintance",
  "established",
  "strong",
] as const;
export type RelationshipStrength = (typeof RELATIONSHIP_STRENGTHS)[number];

export const STRENGTH_LABELS: Record<RelationshipStrength, string> = {
  new: "New",
  acquaintance: "Acquaintance",
  established: "Established",
  strong: "Strong",
};

export const INTERACTION_TYPES = [
  "in_person",
  "email",
  "linkedin",
  "phone",
  "coffee_chat",
  "meeting",
  "other",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  in_person: "In-person conversation",
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone call",
  coffee_chat: "Coffee chat",
  meeting: "Meeting",
  other: "Other",
};

export const CONTACT_SORTS = ["name", "recent", "contacted"] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

export const SORT_LABELS: Record<ContactSort, string> = {
  name: "Name",
  recent: "Recently added",
  contacted: "Recently contacted",
};

/** Cookie the client writes so server code can compute "today" in the user's zone. */
export const TZ_COOKIE = "tz";

/** Days ahead shown in the "Upcoming" follow-up bucket. */
export const UPCOMING_WINDOW_DAYS = 14;

export const APP_NAME = "Rapport";
