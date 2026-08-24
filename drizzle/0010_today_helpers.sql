-- Phase 2 (Quiet Today) expand step 4.3: typed settings column for the Today
-- helper surfaces (SoftStreaks, PickForMe, DailyBrief, DayRituals,
-- PeakFocusNudge). Expand-only; no backfill; default preserves today's UI.
-- Rollback = stop reading the column. Do NOT DROP COLUMN in a hotfix.
ALTER TABLE "user_settings"
  ADD COLUMN "today_helpers" boolean NOT NULL DEFAULT true;
