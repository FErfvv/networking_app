-- =============================================================================
-- Networking CRM — initial schema
--
-- Design notes
--   * Every user-owned table carries user_id and has RLS enabled.
--   * Parent tables expose UNIQUE (id, user_id) so children can use COMPOSITE
--     foreign keys (child.parent_id, child.user_id) -> parent(id, user_id).
--     This makes it impossible, at the database level, to link a row to a
--     record owned by another user — even if RLS were somehow bypassed.
--   * Timestamps are timestamptz (UTC). Follow-ups and event days are plain
--     `date`s because they are calendar days, not instants.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.relationship_category as enum (
  'recruiter', 'engineer', 'professor', 'alumni',
  'student_peer', 'mentor', 'founder', 'other'
);

create type public.relationship_strength as enum (
  'new', 'acquaintance', 'established', 'strong'
);

create type public.interaction_type as enum (
  'in_person', 'email', 'linkedin', 'phone', 'coffee_chat', 'meeting', 'other'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  event_date  date not null default current_date,
  location    text check (char_length(location) <= 200),
  description text check (char_length(description) <= 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index events_user_date_idx on public.events (user_id, event_date desc);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 200),
  company               text check (char_length(company) <= 200),
  job_title             text check (char_length(job_title) <= 200),
  email                 text check (char_length(email) <= 320),
  linkedin_url          text check (char_length(linkedin_url) <= 500),
  relationship_category public.relationship_category not null default 'other',
  relationship_strength public.relationship_strength not null default 'new',
  general_notes         text check (char_length(general_notes) <= 20000),
  where_met             text check (char_length(where_met) <= 200),
  first_met_at          timestamptz not null default now(),
  first_event_id        uuid,
  next_follow_up_on     date,
  next_action           text check (char_length(next_action) <= 500),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, user_id),
  -- Cross-user safe: the event must belong to the same user.
  -- (Column list on SET NULL so user_id is never nulled.)
  foreign key (first_event_id, user_id)
    references public.events (id, user_id)
    on delete set null (first_event_id)
);

create index contacts_user_created_idx   on public.contacts (user_id, created_at desc);
create index contacts_user_name_idx      on public.contacts (user_id, lower(name));
create index contacts_user_company_idx   on public.contacts (user_id, lower(company));
create index contacts_user_followup_idx  on public.contacts (user_id, next_follow_up_on)
  where next_follow_up_on is not null;
create index contacts_first_event_idx    on public.contacts (first_event_id);
create index contacts_name_trgm_idx      on public.contacts
  using gin (lower(name) extensions.gin_trgm_ops);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- interactions (append-only history; never overwrite previous notes)
-- ---------------------------------------------------------------------------
create table public.interactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id       uuid not null,
  event_id         uuid,
  interaction_type public.interaction_type not null default 'in_person',
  notes            text check (char_length(notes) <= 20000),
  location         text check (char_length(location) <= 200),
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  foreign key (event_id, user_id)
    references public.events (id, user_id) on delete set null (event_id)
);

create index interactions_contact_occurred_idx on public.interactions (contact_id, occurred_at desc);
create index interactions_user_occurred_idx    on public.interactions (user_id, occurred_at desc);
create index interactions_event_idx            on public.interactions (event_id);

create trigger interactions_set_updated_at
  before update on public.interactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags + contact_tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index tags_user_name_unique on public.tags (user_id, lower(name));

create table public.contact_tags (
  contact_id uuid not null,
  tag_id     uuid not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade,
  foreign key (tag_id, user_id)     references public.tags (id, user_id)     on delete cascade
);

create index contact_tags_tag_idx on public.contact_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.events       enable row level security;
alter table public.contacts     enable row level security;
alter table public.interactions enable row level security;
alter table public.tags         enable row level security;
alter table public.contact_tags enable row level security;

-- profiles: a user can see and edit only their own row (rows are created by trigger).
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Generic owner policies for every user-owned table.
do $$
declare t text;
begin
  foreach t in array array['events', 'contacts', 'interactions', 'tags', 'contact_tags'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- Anonymous visitors get nothing.
revoke all on public.profiles, public.events, public.contacts,
              public.interactions, public.tags, public.contact_tags from anon;

-- ---------------------------------------------------------------------------
-- contact_overview: contacts + derived fields used by the directory/dashboard.
-- security_invoker => RLS of the querying user applies to the underlying tables.
-- ---------------------------------------------------------------------------
create view public.contact_overview
with (security_invoker = true) as
select
  c.*,
  li.last_interaction_at,
  coalesce(tg.tag_names, '{}'::text[]) as tag_names
from public.contacts c
left join lateral (
  select max(i.occurred_at) as last_interaction_at
  from public.interactions i
  where i.contact_id = c.id
) li on true
left join lateral (
  select array_agg(t.name order by lower(t.name)) as tag_names
  from public.contact_tags ct
  join public.tags t on t.id = ct.tag_id
  where ct.contact_id = c.id
) tg on true;

revoke all on public.contact_overview from anon;
grant select on public.contact_overview to authenticated;

-- ---------------------------------------------------------------------------
-- find_similar_contacts: duplicate suggestions for Quick Add.
-- SECURITY INVOKER (default) so RLS limits results to the caller's contacts.
-- ---------------------------------------------------------------------------
create or replace function public.find_similar_contacts(q text)
returns table (
  id uuid,
  name text,
  company text,
  job_title text,
  score real
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.company, c.job_title,
         greatest(
           extensions.similarity(lower(c.name), lower(btrim(q))),
           case when lower(c.name) like lower(btrim(q)) || '%' then 0.9 else 0 end,
           case when lower(c.name) like '% ' || lower(btrim(q)) || '%' then 0.6 else 0 end
         )::real as score
  from public.contacts c
  where char_length(btrim(q)) >= 2
    and (
      lower(c.name) operator(extensions.%) lower(btrim(q))
      or lower(c.name) like lower(btrim(q)) || '%'
      or lower(c.name) like '% ' || lower(btrim(q)) || '%'
    )
  order by score desc, c.updated_at desc
  limit 5;
$$;

revoke execute on function public.find_similar_contacts(text) from public, anon;
grant execute on function public.find_similar_contacts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- search_contacts: substring search across name, company, title, notes,
-- where-met and interaction notes. Returns contact_overview rows so the app
-- can chain PostgREST filters/sorting on the result.
-- ---------------------------------------------------------------------------
create or replace function public.search_contacts(q text)
returns setof public.contact_overview
language sql
stable
set search_path = ''
as $$
  with term as (
    select '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
  )
  select co.*
  from public.contact_overview co, term
  where co.name ilike term.p
     or co.company ilike term.p
     or co.job_title ilike term.p
     or co.general_notes ilike term.p
     or co.where_met ilike term.p
     or exists (
       select 1 from public.interactions i
       where i.contact_id = co.id and i.notes ilike term.p
     );
$$;

revoke execute on function public.search_contacts(text) from public, anon;
grant execute on function public.search_contacts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- quick_add_contact: atomically create a contact AND its first interaction.
--
-- Idempotent: the client generates both UUIDs. Re-sending the same payload
-- (double tap, network retry, offline queue flush) returns the existing
-- contact instead of creating a duplicate. SECURITY INVOKER, so RLS and the
-- composite foreign keys apply exactly as for direct inserts.
-- ---------------------------------------------------------------------------
create or replace function public.quick_add_contact(
  p_contact_id     uuid,
  p_interaction_id uuid,
  p_name           text,
  p_company        text default null,
  p_job_title      text default null,
  p_email          text default null,
  p_linkedin_url   text default null,
  p_where_met      text default null,
  p_notes          text default null,
  p_event_id       uuid default null,
  p_occurred_at    timestamptz default now()
)
returns table (contact_id uuid, created boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.contacts (
    id, user_id, name, company, job_title, email, linkedin_url,
    where_met, first_met_at, first_event_id
  ) values (
    p_contact_id, v_uid, btrim(p_name), p_company, p_job_title, p_email, p_linkedin_url,
    p_where_met, coalesce(p_occurred_at, now()), p_event_id
  )
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- Already exists: only OK if it is the caller's own row (RLS-filtered).
    if not exists (select 1 from public.contacts c where c.id = p_contact_id) then
      raise exception 'contact id conflict' using errcode = '23505';
    end if;
  end if;

  insert into public.interactions (
    id, user_id, contact_id, event_id, interaction_type, notes, location, occurred_at
  ) values (
    p_interaction_id, v_uid, p_contact_id, p_event_id, 'in_person', nullif(btrim(p_notes), ''),
    p_where_met, coalesce(p_occurred_at, now())
  )
  on conflict (id) do nothing;

  return query select p_contact_id, v_inserted > 0;
end;
$$;

revoke execute on function public.quick_add_contact(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.quick_add_contact(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz) to authenticated;
