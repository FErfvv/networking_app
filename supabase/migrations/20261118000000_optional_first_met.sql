-- ===========================================================================
-- "First met" becomes optional.
--
-- Imported contacts were stamped with the import time as their first-met
-- date, which is almost never when you actually met. The column now allows
-- NULL ("unknown"); imports leave it empty, Quick Add still records it.
--
-- Backfill: clears the date on contacts that were clearly imported, i.e.
--   * first_met_at is exactly created_at (both came from the same now()
--     default in one insert; Quick Add sets first_met_at from the client
--     clock and edits store midday UTC, so neither matches exactly), and
--   * the contact has no interactions (Quick Add always logs one).
-- No other data is touched.
-- ===========================================================================

begin;

alter table public.contacts alter column first_met_at drop not null;

update public.contacts c
set first_met_at = null
where c.first_met_at = c.created_at
  and not exists (select 1 from public.interactions i where i.contact_id = c.id);

commit;

notify pgrst, 'reload schema';
