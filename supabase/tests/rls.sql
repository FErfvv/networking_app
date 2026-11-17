-- =============================================================================
-- Row Level Security & ownership tests.
--
-- Run in the Supabase SQL editor (or `psql`) AFTER applying the migration.
-- Everything happens inside a transaction that is ROLLED BACK, so it leaves
-- no data behind. Any failed assertion aborts with a descriptive error;
-- success ends with the notice "ALL RLS TESTS PASSED".
-- =============================================================================
begin;

-- Two throwaway users.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'rls-a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'rls-b@example.test');

-- ---------------------------------------------------------------------------
-- As user A: create data through the same paths the app uses.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

insert into public.events (id, name, event_date)
values ('e0000000-0000-4000-8000-00000000000a', 'A Career Fair', '2026-10-01');

do $$
declare r record;
begin
  -- Quick add creates contact + first interaction atomically.
  select * into r from public.quick_add_contact(
    'c0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000a'::uuid,
    'Ada Lovelace', 'Analytical Engines', 'Engineer', null, null, 'Booth 12',
    'Talked about the difference engine', 'e0000000-0000-4000-8000-00000000000a', now());
  assert r.created, 'quick_add_contact should create a new contact';

  assert (select count(*) from public.contacts) = 1, 'A should see 1 contact';
  assert (select count(*) from public.interactions) = 1, 'quick add should log 1 interaction';
  assert (select first_event_id from public.contacts) = 'e0000000-0000-4000-8000-00000000000a',
    'contact should be linked to the active event';

  -- Idempotency: replaying the same submission must not duplicate anything.
  select * into r from public.quick_add_contact(
    'c0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000a'::uuid,
    'Ada Lovelace', null, null, null, null, null, 'retry', null, now());
  assert not r.created, 'replayed quick add should report created = false';
  assert (select count(*) from public.contacts) = 1, 'replay must not duplicate contact';
  assert (select count(*) from public.interactions) = 1, 'replay must not duplicate interaction';

  -- A second interaction appends to history; the first is untouched.
  insert into public.interactions (contact_id, interaction_type, notes)
  values ('c0000000-0000-4000-8000-00000000000a', 'email', 'Sent follow-up');
  assert (select count(*) from public.interactions) = 2, 'history should have 2 entries';
  assert exists (select 1 from public.interactions where notes = 'Talked about the difference engine'),
    'original notes must be preserved';

  -- Derived view + search + duplicate suggestions.
  assert (select last_interaction_at is not null from public.contact_overview),
    'contact_overview should expose last_interaction_at';
  assert (select count(*) from public.search_contacts('follow-up')) = 1,
    'search should match interaction notes';
  assert (select count(*) from public.search_contacts('analytical')) = 1,
    'search should match company';
  assert (select count(*) from public.search_contacts('100%')) = 0,
    'search should treat % literally';
  assert (select count(*) from public.find_similar_contacts('ada lov')) = 1,
    'similar-name lookup should find Ada';
  assert (select count(*) from public.find_similar_contacts('Lovelace')) = 1,
    'similar-name lookup should match a last name';

  -- Tags are unique per user, case-insensitively.
  insert into public.tags (name) values ('ML');
  begin
    insert into public.tags (name) values ('ml');
    raise exception 'FAIL: duplicate tag (case-insensitive) was allowed';
  exception when unique_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- As user B: must not see or touch A's data.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);

do $$
declare n int;
begin
  assert (select count(*) from public.contacts) = 0, 'B must not see A''s contacts';
  assert (select count(*) from public.interactions) = 0, 'B must not see A''s interactions';
  assert (select count(*) from public.events) = 0, 'B must not see A''s events';
  assert (select count(*) from public.tags) = 0, 'B must not see A''s tags';
  assert (select count(*) from public.contact_overview) = 0, 'view must respect RLS';
  assert (select count(*) from public.search_contacts('ada')) = 0, 'search must respect RLS';
  assert (select count(*) from public.find_similar_contacts('ada')) = 0, 'suggestions must respect RLS';

  -- Updates/deletes against A's rows silently affect nothing.
  update public.contacts set name = 'hacked' where id = 'c0000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A''s contact';
  delete from public.contacts where id = 'c0000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A''s contact';

  -- Inserting a row claiming to be A is blocked by RLS.
  begin
    insert into public.contacts (user_id, name)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'spoofed');
    raise exception 'FAIL: B inserted a row owned by A';
  exception when insufficient_privilege then null;
  end;

  -- Linking B's interaction to A's contact is blocked by the composite FK.
  begin
    insert into public.interactions (contact_id, notes)
    values ('c0000000-0000-4000-8000-00000000000a', 'cross-user link');
    raise exception 'FAIL: B linked an interaction to A''s contact';
  exception when foreign_key_violation then null;
  end;

  -- Linking B's new contact to A's event is blocked too.
  begin
    perform public.quick_add_contact(
      'c0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-00000000000b'::uuid,
      'Bob', null, null, null, null, null, null, 'e0000000-0000-4000-8000-00000000000a', now());
    raise exception 'FAIL: B linked a contact to A''s event';
  exception when foreign_key_violation then null;
  end;

  -- Reusing A's contact id via quick add must fail, not leak or overwrite.
  begin
    perform public.quick_add_contact(
      'c0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000c'::uuid,
      'Bob', null, null, null, null, null, null, null, now());
    raise exception 'FAIL: B reused A''s contact id';
  exception when unique_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous visitors get nothing.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform count(*) from public.contacts;
    raise exception 'FAIL: anon could read contacts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.quick_add_contact(gen_random_uuid(), gen_random_uuid(), 'x');
    raise exception 'FAIL: anon could call quick_add_contact';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Deleting an event keeps contacts and interactions (link is cleared).
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
begin
  delete from public.events where id = 'e0000000-0000-4000-8000-00000000000a';
  assert (select count(*) from public.contacts) = 1, 'contact must survive event deletion';
  assert (select first_event_id is null from public.contacts), 'first_event_id must be cleared';
  assert (select count(*) from public.interactions where event_id is not null) = 0,
    'interaction event links must be cleared';
  assert (select count(*) from public.contacts where user_id is null) = 0,
    'user_id must never be nulled by SET NULL';

  -- Deleting a contact cascades to its interactions.
  delete from public.contacts where id = 'c0000000-0000-4000-8000-00000000000a';
  assert (select count(*) from public.interactions) = 0, 'interactions must cascade-delete';

  raise notice 'ALL RLS TESTS PASSED';
end $$;

rollback;
