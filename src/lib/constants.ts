export const RELATIONSHIP_CATEGORIES = [
  "recruiter",
  "engineer",
  "professor",
  "alumni",
  "student_peer",
  "mentor",
  "founder",
  "other",
] as const;
export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  recruiter: "Recruiter",
  engineer: "Engineer",
  professor: "Professor",
  alumni: "Alumni",
  student_peer: "Student / Peer",
  mentor: "Mentor",
  founder: "Founder",
  other: "Other",
};

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
