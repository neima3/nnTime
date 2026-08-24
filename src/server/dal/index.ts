/**
 * Data Access Layer (DAL) — ADR-005 SEC-01.
 *
 * Every function here scopes by the authenticated session's userId IN THE SAME
 * PREDICATE. Client-supplied owner IDs are ignored. Nested resources verify
 * parent ownership. This is the ONLY module that touches the DB; route handlers
 * and Server Components call it. `server-only` enforced.
 *
 * Mutations:
 *  - Bump `revision` inside the same transaction.
 *  - If-Match conflicts → throw ConflictError (409).
 *  - Tombstone on delete (set deleted_at), never hard-delete.
 *  - Append to change_log on every mutation (ADR-002 sync feed).
 *  - Append to planner_events for domain events (ADR-001 history).
 *
 * This file is the barrel: the public surface of the DAL. The implementations
 * live in the per-resource modules below; nothing outside `src/server/dal/`
 * imports them directly.
 */
import "server-only";

export type { Db } from "./types";
export { ConflictError, NotFoundError } from "./errors";

export {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  listChecklistItems,
  scheduleTask,
} from "./tasks";

export {
  listActivitySeries,
  getActivitySeries,
  createActivitySeries,
  deleteActivitySeries,
  listOccurrences,
  listUserOccurrences,
  upsertOccurrence,
} from "./activities";

export {
  assertOwnedActivityReferences,
  listTags,
  createTag,
  getTag,
  updateTag,
  deleteTag,
  listCategories,
  getOrCreateSettings,
  updateSettings,
} from "./tags-categories-settings";

export {
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  listRoutineSteps,
  listRoutineSchedules,
  createRoutineSchedule,
  updateRoutineSchedule,
} from "./routines";

export { getChanges, appendChangeLog, appendPlannerEvent } from "./events-changes";

export {
  createClientErrorReport,
  listClientErrorReports,
} from "./client-error-reports";
