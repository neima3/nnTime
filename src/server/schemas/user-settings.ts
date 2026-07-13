/**
 * User settings resource schemas.
 *
 * Mirrors the `user_settings` table in src/server/db/schema.ts (ADR-001 typed
 * columns — NOT JSON — for timezone/locale/etc; JSON only for presentation
 * extras in notification_prefs). PK is `user_id`. Note: user_settings has no
 * deletedAt tombstone (it cascades with the user). Checked for drift against
 * api/openapi.yaml in CI.
 */

import { z } from "zod";
import {
  hourCycleEnum,
  ianaTimezone,
  instant,
  jsonObject,
  revision,
  themeModeEnum,
  weekStartEnum,
} from "./common";

/** User settings response body. */
export const userSettingsResponse = z.object({
  userId: z.uuid(),
  /**
   * IANA timezone key (e.g. "America/Los_Angeles"). Validated as a non-empty
   * string here; full IANA membership checked in the service layer.
   */
  timezone: ianaTimezone,
  locale: z.string(),
  /** 0=Sun … 6=Sat. */
  weekStart: weekStartEnum,
  hourCycle: hourCycleEnum,
  theme: themeModeEnum,
  reducedStimulation: z.boolean(),
  /** Presentation-only extras: reminder offsets, sounds, quiet hours (jsonb). */
  notificationPrefs: jsonObject,
  schemaVersion: z.number().int(),
  revision,
  createdAt: instant,
  updatedAt: instant,
});

/** PATCH /api/v1/user/settings body. */
export const userSettingsUpdate = z.object({
  timezone: ianaTimezone.optional(),
  locale: z.string().optional(),
  weekStart: weekStartEnum.optional(),
  hourCycle: hourCycleEnum.optional(),
  theme: themeModeEnum.optional(),
  reducedStimulation: z.boolean().optional(),
  notificationPrefs: jsonObject.optional(),
});

export type UserSettingsResponse = z.infer<typeof userSettingsResponse>;
export type UserSettingsUpdate = z.infer<typeof userSettingsUpdate>;
