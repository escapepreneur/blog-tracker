-- Prevention only: stop NEW tables/sequences in public being open to logged-out visitors (anon)
-- by default. Existing tables keep their current permissions. The default for `authenticated`
-- is deliberately left alone. No `for role supabase_admin` lines (they are not permitted here).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
