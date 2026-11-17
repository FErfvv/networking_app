/**
 * Hand-written to mirror supabase/migrations. Regenerate with
 *   npx supabase gen types typescript --project-id <id> > src/lib/types/database.ts
 * once the project is linked, if you prefer generated types.
 */
import type {
  CategoryColor,
  InteractionType,
  RelationshipStrength,
} from "@/lib/constants";

type Timestamp = string; // ISO 8601 (timestamptz)
type DateOnly = string; // YYYY-MM-DD (date)

export type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  other_contact: string | null;
  linkedin_url: string | null;
  relationship_strength: RelationshipStrength;
  general_notes: string | null;
  where_met: string | null;
  first_met_at: Timestamp;
  first_event_id: string | null;
  next_follow_up_on: DateOnly | null;
  next_action: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** A category as embedded in contact_overview.categories. */
export type ContactCategory = Pick<CategoryRow, "id" | "name" | "color">;

export type ContactOverviewRow = ContactRow & {
  /** Sorted by name; empty when uncategorized. */
  categories: ContactCategory[];
  category_ids: string[];
  last_interaction_at: Timestamp | null;
  tag_names: string[];
};

export type InteractionRow = {
  id: string;
  user_id: string;
  contact_id: string;
  event_id: string | null;
  interaction_type: InteractionType;
  notes: string | null;
  location: string | null;
  occurred_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type EventRow = {
  id: string;
  user_id: string;
  name: string;
  event_date: DateOnly;
  location: string | null;
  description: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: CategoryColor;
  created_at: Timestamp;
};

export type TagRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: Timestamp;
};

export type ContactCategoryRow = {
  contact_id: string;
  category_id: string;
  user_id: string;
  created_at: Timestamp;
};

export type ContactTagRow = {
  contact_id: string;
  tag_id: string;
  user_id: string;
  created_at: Timestamp;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  created_at: Timestamp;
};

type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type Table<Row, Insert, Rels = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, WithOptional<ProfileRow, "display_name" | "created_at">>;
      events: Table<
        EventRow,
        WithOptional<
          EventRow,
          "id" | "user_id" | "event_date" | "location" | "description" | "created_at" | "updated_at"
        >
      >;
      contacts: Table<
        ContactRow,
        WithOptional<
          ContactRow,
          | "id"
          | "user_id"
          | "company"
          | "job_title"
          | "email"
          | "phone"
          | "other_contact"
          | "linkedin_url"
          | "relationship_strength"
          | "general_notes"
          | "where_met"
          | "first_met_at"
          | "first_event_id"
          | "next_follow_up_on"
          | "next_action"
          | "created_at"
          | "updated_at"
        >,
        [
          {
            foreignKeyName: "contacts_first_event_id_user_id_fkey";
            columns: ["first_event_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "user_id"];
          },
        ]
      >;
      interactions: Table<
        InteractionRow,
        WithOptional<
          InteractionRow,
          | "id"
          | "user_id"
          | "event_id"
          | "interaction_type"
          | "notes"
          | "location"
          | "occurred_at"
          | "created_at"
          | "updated_at"
        >,
        [
          {
            foreignKeyName: "interactions_contact_id_user_id_fkey";
            columns: ["contact_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "interactions_event_id_user_id_fkey";
            columns: ["event_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "user_id"];
          },
        ]
      >;
      categories: Table<
        CategoryRow,
        WithOptional<CategoryRow, "id" | "user_id" | "color" | "created_at">
      >;
      contact_categories: Table<
        ContactCategoryRow,
        WithOptional<ContactCategoryRow, "user_id" | "created_at">,
        [
          {
            foreignKeyName: "contact_categories_contact_id_user_id_fkey";
            columns: ["contact_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "contact_categories_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ]
      >;
      tags: Table<TagRow, WithOptional<TagRow, "id" | "user_id" | "created_at">>;
      contact_tags: Table<
        ContactTagRow,
        WithOptional<ContactTagRow, "user_id" | "created_at">,
        [
          {
            foreignKeyName: "contact_tags_contact_id_user_id_fkey";
            columns: ["contact_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "contact_tags_tag_id_user_id_fkey";
            columns: ["tag_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "user_id"];
          },
        ]
      >;
    };
    Views: {
      contact_overview: {
        Row: ContactOverviewRow;
        Relationships: [];
      };
    };
    Functions: {
      find_similar_contacts: {
        Args: { q: string };
        Returns: {
          id: string;
          name: string;
          company: string | null;
          job_title: string | null;
          score: number;
        }[];
      };
      search_contacts: {
        Args: { q: string };
        Returns: ContactOverviewRow[];
        SetofOptions: {
          from: "*";
          to: "contact_overview";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      quick_add_contact: {
        Args: {
          p_contact_id: string;
          p_interaction_id: string;
          p_name: string;
          p_company?: string | null;
          p_job_title?: string | null;
          p_email?: string | null;
          p_linkedin_url?: string | null;
          p_where_met?: string | null;
          p_notes?: string | null;
          p_event_id?: string | null;
          p_occurred_at?: string;
          p_phone?: string | null;
          p_other_contact?: string | null;
        };
        Returns: { contact_id: string; created: boolean }[];
      };
    };
    Enums: {
      relationship_strength: RelationshipStrength;
      interaction_type: InteractionType;
    };
    CompositeTypes: Record<string, never>;
  };
};
