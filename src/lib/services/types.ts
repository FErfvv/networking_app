import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type Db = SupabaseClient<Database>;

/** Everything a service needs: a user-scoped client and the verified user id. */
export type ServiceCtx = { supabase: Db; userId: string };
