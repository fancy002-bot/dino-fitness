-- Loadbook on Supabase.
--
-- The app talks to exactly one interface -- doc(path)/collection(path) over JSON
-- documents -- so the fastest faithful port is a document store, not a schema
-- per feature. One table, one row per document, the path carrying the shape:
--
--   sessions/2026-09-06          a day of training
--   exercises/back-squat         a movement in the repertoire
--   routines/r_ab12              a saved workout
--   settings/goals               targets, units, body figures
--   settings/rewards             tokens, specimens owned, eras, freezes
--   profiles/p_XXXXXXXXXX        a collector card, readable by every signed-in user
--   invites/LB-XXXX-XXXX         a one-time friend code
--   friends/p_XXXXXXXXXX/list/p_YYYYYYYYYY   one side of a fellowship
--
-- Profile ids stay the app's own `p_` handles rather than becoming auth uids:
-- they are printed on the collector key, and rewriting them would invalidate
-- every key already in someone's hands. `owner` is what RLS reads.

create extension if not exists pgcrypto;

create table if not exists docs (
  owner       uuid not null references auth.users(id) on delete cascade,
  path        text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (owner, path)
);

-- the collection query is "children of this path", i.e. a prefix match that
-- stops at the next slash; a btree on text_pattern_ops is what makes LIKE 'x/%'
-- an index scan rather than a sequential one
create index if not exists docs_path_prefix on docs (owner, path text_pattern_ops);
-- the Society reads across owners, always by exact path or by a jsonb field
create index if not exists docs_path on docs (path text_pattern_ops);
create index if not exists docs_data on docs using gin (data);

alter table docs enable row level security;

-- ---------------------------------------------------------------------------
-- Your own ledger is yours. Everything under sessions/, exercises/, routines/
-- and settings/ is readable and writable by exactly one person.
-- ---------------------------------------------------------------------------
create policy docs_own_all on docs
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ---------------------------------------------------------------------------
-- A collector card is public to signed-in users: that is how a fellow's streak
-- and collection render on someone else's screen. Writable only by its owner,
-- which the policy above already covers.
-- ---------------------------------------------------------------------------
create policy docs_profiles_read on docs
  for select to authenticated
  using (path like 'profiles/%');

-- ---------------------------------------------------------------------------
-- Fellowship rows are readable by both sides. The `friends/<me>/list/<them>`
-- row is written only by redeem_invite() below, never by the client.
-- ---------------------------------------------------------------------------
create policy docs_friends_read on docs
  for select to authenticated
  using (
    path like 'friends/%'
    and (
      owner = auth.uid()
      or exists (
        select 1 from docs p
        where p.owner = auth.uid()
          and p.path = 'profiles/' || split_part(docs.path, '/', 2)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Invites are deliberately NOT readable by code. Letting a client select by
-- code means anyone can enumerate LB-XXXX-XXXX until one hits; redemption goes
-- through the function below instead, and the issuer sees only their own.
-- ---------------------------------------------------------------------------
create policy docs_invites_read_own on docs
  for select to authenticated
  using (path like 'invites/%' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Redemption, atomically.
--
-- The client version of this was: mark the code used, then write the two
-- fellowship rows. If the second half failed, a one-time code was spent on a
-- fellowship that does not exist, and there is no second code. In Postgres it
-- is one transaction -- it either all happens or none of it does, and the
-- rollback the client had to perform by hand stops existing.
-- ---------------------------------------------------------------------------
create or replace function redeem_invite(code text, my_profile text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv        docs%rowtype;
  my_name    text;
  now_iso    text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  their_id   text;
begin
  if code !~ '^LB-[A-Z2-9]{4}-[A-Z2-9]{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'malformed');
  end if;

  -- the caller must actually hold the profile they claim to be redeeming as
  select data->>'name' into my_name
    from docs
   where owner = auth.uid() and path = 'profiles/' || my_profile;
  if my_name is null then
    return jsonb_build_object('ok', false, 'reason', 'no_card');
  end if;

  -- one redeemer at a time; a second concurrent call waits here and then finds
  -- the row already used rather than racing past the check
  select * into inv from docs where path = 'invites/' || code for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if (inv.data->>'used')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  their_id := inv.data->>'from';
  if their_id = my_profile then
    return jsonb_build_object('ok', false, 'reason', 'own');
  end if;

  update docs
     set data = data || jsonb_build_object(
           'used', true, 'usedBy', my_profile, 'usedByName', my_name, 'usedAt', now_iso),
         updated_at = now()
   where path = 'invites/' || code;

  insert into docs (owner, path, data)
  values (auth.uid(), 'friends/' || my_profile || '/list/' || their_id,
          jsonb_build_object('id', their_id, 'since', now_iso))
  on conflict (owner, path) do update set data = excluded.data, updated_at = now();

  insert into docs (owner, path, data)
  values (inv.owner, 'friends/' || their_id || '/list/' || my_profile,
          jsonb_build_object('id', my_profile, 'since', now_iso))
  on conflict (owner, path) do update set data = excluded.data, updated_at = now();

  return jsonb_build_object('ok', true, 'fromName', inv.data->>'fromName', 'from', their_id);
end;
$$;

revoke all on function redeem_invite(text, text) from public;
grant execute on function redeem_invite(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Removing a fellow clears both sides, which crosses an owner boundary and so
-- needs the same treatment.
-- ---------------------------------------------------------------------------
create or replace function remove_fellow(my_profile text, their_profile text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from docs
                  where owner = auth.uid() and path = 'profiles/' || my_profile) then
    raise exception 'not your card';
  end if;
  delete from docs where path = 'friends/' || my_profile || '/list/' || their_profile;
  delete from docs where path = 'friends/' || their_profile || '/list/' || my_profile;
end;
$$;

revoke all on function remove_fellow(text, text) from public;
grant execute on function remove_fellow(text, text) to authenticated;

-- realtime: the app's onSnapshot is a subscription to changes on docs
alter publication supabase_realtime add table docs;
