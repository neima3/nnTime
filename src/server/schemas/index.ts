/**
 * Kairo REST API zod schema registry.
 *
 * Aggregates and re-exports every hand-written zod schema for the Phase 1A
 * REST API. These mirror src/server/db/schema.ts and are checked for parity
 * against api/openapi.yaml by the contract-parity test in CI.
 *
 * `responseSchemaRegistry` maps OpenAPI component names → zod schema objects;
 * the parity test walks it. Adding a component to the spec means adding a key
 * here AND a matching schema file. Hand-written, NOT drizzle-zod generated.
 */

export * from "./common";
export * from "./envelope";
export * from "./category";
export * from "./tag";
export * from "./task";
export * from "./activity-series";
export * from "./activity-occurrence";
export * from "./checklist-item";
export * from "./routine";
export * from "./focus-session";
export * from "./planner-event";
export * from "./user-settings";
export * from "./batch";
export * from "./change";
export * from "./day";

// Re-import the schema objects (named exports from above) to build the registry.
import { errorEnvelope } from "./envelope";
import { categoryResponse } from "./category";
import { tagResponse } from "./tag";
import { taskResponse } from "./task";
import { activitySeriesResponse } from "./activity-series";
import { activityOccurrenceResponse } from "./activity-occurrence";
import { checklistItemResponse } from "./checklist-item";
import {
  routineResponse,
  routineStepResponse,
  routineScheduleResponse,
} from "./routine";
import { focusSessionResponse } from "./focus-session";
import { plannerEventResponse } from "./planner-event";
import { userSettingsResponse } from "./user-settings";
import { batchRequest, batchResponse } from "./batch";
import { changeLogEntry, changesResponse } from "./change";
import { dayResponse } from "./day";

/**
 * Registry of response/component schemas keyed by the OpenAPI component name.
 * The contract-parity test walks this object and compares each schema against
 * the matching component in api/openapi.yaml.
 */
export const responseSchemaRegistry = {
  Error: errorEnvelope,
  Category: categoryResponse,
  Tag: tagResponse,
  Task: taskResponse,
  ActivitySeries: activitySeriesResponse,
  ActivityOccurrence: activityOccurrenceResponse,
  ChecklistItem: checklistItemResponse,
  Routine: routineResponse,
  RoutineStep: routineStepResponse,
  RoutineSchedule: routineScheduleResponse,
  FocusSession: focusSessionResponse,
  PlannerEvent: plannerEventResponse,
  UserSettings: userSettingsResponse,
  BatchRequest: batchRequest,
  BatchResponse: batchResponse,
  ChangeLogEntry: changeLogEntry,
  ChangesResponse: changesResponse,
  DayResponse: dayResponse,
} as const;

/** Type alias for the component-name keys, for consumers/tests. */
export type ResponseSchemaName = keyof typeof responseSchemaRegistry;

/**
 * Convenience type: maps each component name to its inferred TS type. Useful
 * for route handlers that want the inferred shape without re-inferring.
 */
export type ResponseSchemaRegistry = typeof responseSchemaRegistry;
