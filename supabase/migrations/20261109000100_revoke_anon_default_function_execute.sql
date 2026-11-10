-- Prevention only: NEW functions in public are no longer runnable by logged-out visitors (anon).
-- Postgres also grants EXECUTE to PUBLIC by default, so that global default is revoked too (the
-- per-schema line alone cannot remove it). `authenticated` and `service_role` keep their defaults.
-- Existing functions are unchanged. No `for role supabase_admin` lines (not permitted here).
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges revoke execute on functions from public;
