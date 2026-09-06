-- Fix: infinite recursion in the fellowship read policy.
--
-- docs_friends_read asked "does a profiles/<id> row belong to me?" with a
-- subquery against docs -- from inside a policy on docs. Postgres re-applies
-- the policy to that subquery, which re-runs the subquery, and the whole table
-- becomes unreadable with 42P17. It is not specific to friends rows either:
-- permissive policies are all evaluated on every select, so a single recursive
-- one takes down every read of the table.
--
-- The fix is the standard one: ask the question inside a security definer
-- function, which runs as the table's owner and is therefore not subject to
-- the policy it is being consulted by.

create or replace function owns_profile(pid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from docs
     where owner = auth.uid()
       and path = 'profiles/' || pid
  );
$$;

revoke all on function owns_profile(text) from public;
grant execute on function owns_profile(text) to authenticated;

drop policy if exists docs_friends_read on docs;

create policy docs_friends_read on docs
  for select to authenticated
  using (
    path like 'friends/%'
    and (owner = auth.uid() or owns_profile(split_part(path, '/', 2)))
  );
