-- ===========================================================================
-- Multiple categories per contact.
--
-- Replaces contacts.category_id with a contact_categories link table. Every
-- existing category assignment is copied across before the column is dropped,
-- so no labels are lost.
--
-- contact_overview now exposes:
--   categories    jsonb   [{id, name, color}, …] sorted by name ('[]' if none)
--   category_ids  uuid[]  for filtering ('{}' if none)
--
-- contact_overview is defined with `c.*`, so it (and search_contacts, which
-- returns its row type) must be dropped before the column change and recreated.
-- ===========================================================================

begin;

drop function if exists public.search_contacts(text);
drop view if exists public.contact_overview;

-- ---------------------------------------------------------------------------
-- contact_categories (composite FKs: both sides must belong to the same user)
-- ---------------------------------------------------------------------------
create table public.contact_categories (
  contact_id  uuid not null,
  category_id uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (contact_id, category_id),
  foreign key (contact_id, user_id)  references public.contacts (id, user_id)   on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

create index contact_categories_category_idx on public.contact_categories (category_id);

alter table public.contact_categories enable row level security;

create policy contact_categories_select_own on public.contact_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy contact_categories_insert_own on public.contact_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy contact_categories_update_own on public.contact_categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contact_categories_delete_own on public.contact_categories
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.contact_categories from anon;

-- Carry every existing assignment across, then retire the single-value column.
insert into public.contact_categories (contact_id, category_id, user_id)
select id, category_id, user_id
from public.contacts
where category_id is not null
on conflict do nothing;

alter table public.contacts drop column category_id;

-- ---------------------------------------------------------------------------
-- contact_overview: categories (jsonb) + category_ids (uuid[])
-- ---------------------------------------------------------------------------
create view public.contact_overview
with (security_invoker = true) as
select
  c.*,
  coalesce(cc.categories, '[]'::jsonb) as categories,
  coalesce(cc.category_ids, '{}'::uuid[]) as category_ids,
  li.last_interaction_at,
  coalesce(tg.tag_names, '{}'::text[]) as tag_names
from public.contacts c
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object('id', cat.id, 'name', cat.name, 'color', cat.color)
      order by lower(cat.name)
    ) as categories,
    array_agg(cat.id order by lower(cat.name)) as category_ids
  from public.contact_categories x
  join public.categories cat on cat.id = x.category_id
  where x.contact_id = c.id
) cc on true
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
-- search_contacts: matches any of the contact's category names.
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
     or exists (
       select 1
       from public.contact_categories x
       join public.categories cat on cat.id = x.category_id
       where x.contact_id = co.id and cat.name ilike term.p
     )
     or exists (
       select 1 from public.interactions i
       where i.contact_id = co.id and i.notes ilike term.p
     );
$$;

revoke execute on function public.search_contacts(text) from public, anon;
grant execute on function public.search_contacts(text) to authenticated;

commit;

notify pgrst, 'reload schema';
