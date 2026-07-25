-- SUPERSEDED — intentionally a no-op. Same defect as 0006: this DO block also
-- referenced "users" (plural), which does not exist in this schema, so a
-- from-scratch migration died here before reaching 0008.
--
-- 0008_push_subs_fk_fix.sql is the corrected rebuild (FK to "user"). See the
-- note in 0006_rebuild_push_subs.sql for the full history.
--
-- Do not restore statements here — add a new numbered migration instead.
SELECT 1;
