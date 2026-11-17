-- ===========================================================================
-- Editable, per-user relationship categories.
--
-- Replaces the fixed `relationship_category` enum with a `categories` table
-- each user can add to, rename, recolor and delete from. Contacts reference a
-- category by id; NULL means "no category" (this replaces the old 'other').
--
-- Existing users get the previous built-in categories, and every contact keeps
-- its category. New users get the same defaults via handle_new_user().
--
-- contact_overview is defined with `c.*`, so it (and search_contacts, which
-- returns its row type) must be dropped before the column change and recreated.
-- ===========================================================================

begin;

drop function if exists public.search_contacts(text);
drop view if exists public.contact_overview;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 50),
  color      text not null default 'slate' check (color in (
               'slate', 'sky', 'blue', 'violet', 'pink', 'rose',
               'orange', 'amber', 'emerald', 'teal'
             )),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index categories_user_name_unique on public.categories (user_id, lower(name));

alter table public.categories enable row level security;

create policy categories_select_own on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy categories_insert_own on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy categories_update_own on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete_own on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.categories from anon;

-- ---------------------------------------------------------------------------
-- contacts.category_id (composite FK: can only point at the owner's category)
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column category_id uuid,
  add foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete set null (category_id);

create index contacts_category_idx on public.contacts (category_id);

-- ---------------------------------------------------------------------------
-- Default categories (the previous built-in list, minus 'other').
-- Not callable by API users; only the signup trigger and this migration use it.
-- ---------------------------------------------------------------------------
create function public.seed_default_categories(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.categories (user_id, name, color)
  values
    (p_user_id, 'Recruiter',      'sky'),
    (p_user_id, 'Engineer',       'violet'),
    (p_user_id, 'Professor',      'amber'),
    (p_user_id, 'Alumni',         'emerald'),
    (p_user_id, 'Student / Peer', 'teal'),
    (p_user_id, 'Mentor',         'rose'),
    (p_user_id, 'Founder',        'orange')
  on conflict (user_id, lower(name)) do nothing;
$$;

revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

-- Existing users: seed, then carry every contact's category across.
select public.seed_default_categories(u.id) from auth.users u;

update public.contacts c
set category_id = cat.id
from public.categories cat,
     (values
        ('recruiter',    'Recruiter'),
        ('engineer',     'Engineer'),
        ('professor',    'Professor'),
        ('alumni',       'Alumni'),
        ('student_peer', 'Student / Peer'),
        ('mentor',       'Mentor'),
        ('founder',      'Founder')
     ) as m(old_key, name)
where cat.user_id = c.user_id
  and lower(cat.name) = lower(m.name)
  and c.relationship_category::text = m.old_key;

alter table public.contacts drop column relationship_category;
drop type public.relationship_category;

-- ---------------------------------------------------------------------------
-- contact_overview: + category_name, category_color
-- ---------------------------------------------------------------------------
create view public.contact_overview
with (security_invoker = true) as
select
  c.*,
  cat.name  as category_name,
  cat.color as category_color,
  li.last_interaction_at,
  coalesce(tg.tag_names, '{}'::text[]) as tag_names
from public.contacts c
left join public.categories cat on cat.id = c.category_id
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
-- search_contacts: unchanged, plus matching the category name.
-- ---------------------------------------------------------------------------
create function public.search_contacts(q text)
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
     or co.email ilike term.p
     or co.phone ilike term.p
     or co.other_contact ilike term.p
     or co.category_name ilike term.p
     or exists (
       select 1 from public.interactions i
       where i.contact_id = co.id and i.notes ilike term.p
     );
$$;

revoke execute on function public.search_contacts(text) from public, anon;
grant execute on function public.search_contacts(text) to authenticated;

commit;

notify pgrst, 'reload schema';
