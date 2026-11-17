-- ===========================================================================
-- Contacts: add phone + free-form "other" contact info.
--
-- contact_overview is defined with `c.*`, which Postgres expands when the view
-- is created, so the view (and search_contacts, which returns its row type)
-- must be recreated to expose the new columns. quick_add_contact gains two
-- parameters, which changes its signature, so the old one is dropped.
-- ===========================================================================

begin;

drop function if exists public.search_contacts(text);
drop view if exists public.contact_overview;

alter table public.contacts
  add column phone         text check (char_length(phone) <= 50),
  add column other_contact text check (char_length(other_contact) <= 500);

-- ---------------------------------------------------------------------------
-- contact_overview (unchanged apart from picking up the new columns)
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
-- search_contacts: now also matches email, phone and other contact info.
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
       select 1 from public.interactions i
       where i.contact_id = co.id and i.notes ilike term.p
     );
$$;

revoke execute on function public.search_contacts(text) from public, anon;
grant execute on function public.search_contacts(text) to authenticated;

-- ---------------------------------------------------------------------------
-- quick_add_contact: + p_phone, p_other_contact
-- ---------------------------------------------------------------------------
drop function if exists public.quick_add_contact(
  uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz
);

create function public.quick_add_contact(
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
  p_occurred_at    timestamptz default now(),
  p_phone          text default null,
  p_other_contact  text default null
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
    id, user_id, name, company, job_title, email, phone, other_contact, linkedin_url,
    where_met, first_met_at, first_event_id
  ) values (
    p_contact_id, v_uid, btrim(p_name), p_company, p_job_title, p_email, p_phone,
    p_other_contact, p_linkedin_url, p_where_met, coalesce(p_occurred_at, now()), p_event_id
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

revoke execute on function public.quick_add_contact(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.quick_add_contact(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz, text, text) to authenticated;

commit;

-- Make PostgREST pick up the new columns and function signature immediately.
notify pgrst, 'reload schema';
