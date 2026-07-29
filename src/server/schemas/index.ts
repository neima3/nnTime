/**
 * Kairo REST API zod schema registry.
 *
 * Aggregates and re-exports every hand-written zod schema for the Phase 1A
 * REST API. These mirror src/server/db/schema.ts and are checked for parity
 * against api/openapi.yaml by the contract-parity test in CI.
 *
 * The response and request registries map OpenAPI component names → zod schema
 * objects; the parity test walks both. Adding a component to the spec means
 * adding a key here AND a matching schema file. Hand-written, NOT
 * drizzle-zod generated.
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
export * from "./search";
export * from "./stats";
export * from "./native-auth";

// Re-import the schema objects (named exports from above) to build the registry.
import { errorEnvelope } from "./envelope";
import { categoryResponse, categoryUpdate } from "./category";
import { tagCreate, tagResponse, tagUpdate } from "./tag";
import { taskCreate, taskResponse, taskUpdate } from "./task";
import {
  activitySeriesCreate,
  activitySeriesResponse,
  activitySeriesUpdate,
} from "./activity-series";
import {
  activityOccurrencePatch,
  activityOccurrenceResponse,
} from "./activity-occurrence";
import {
  checklistItemCreate,
  checklistItemResponse,
  checklistItemUpdate,
} from "./checklist-item";
import {
  routineCreate,
  routineDetailResponse,
  routineListItemResponse,
  routineResponse,
  routineScheduleCreate,
  routineStepResponse,
  routineStepCreate,
  routineScheduleResponse,
  routineUpdate,
} from "./routine";
import {
  focusSessionCreateRequest,
  focusSessionPatchRequest,
  focusSessionResponse,
  focusSnapshotResponse,
} from "./focus-session";
import { plannerEventResponse } from "./planner-event";
import { userSettingsResponse, userSettingsUpdate } from "./user-settings";
import { batchRequest, batchResponse, batchResult } from "./batch";
import { changeLogEntry, changesResponse } from "./change";
import { dayActivityResponse, dayResponse } from "./day";
import { searchHit, searchResponse } from "./search";
import {
  moodCheckinRequest,
  moodCheckinResponse,
  statsResponse,
} from "./stats";
import {
  appleChallengeRequest,
  appleChallengeResponse,
  appleExchangeRequest,
  appleExchangeResponse,
  authCapabilitiesResponse,
} from "./native-auth";

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
  RoutineDetail: routineDetailResponse,
  RoutineListItem: routineListItemResponse,
  RoutineStep: routineStepResponse,
  RoutineSchedule: routineScheduleResponse,
  FocusSession: focusSessionResponse,
  FocusSnapshot: focusSnapshotResponse,
  PlannerEvent: plannerEventResponse,
  UserSettings: userSettingsResponse,
  BatchResult: batchResult,
  BatchResponse: batchResponse,
  ChangeLogEntry: changeLogEntry,
  ChangesResponse: changesResponse,
  DayActivity: dayActivityResponse,
  DayResponse: dayResponse,
  SearchHit: searchHit,
  SearchResponse: searchResponse,
  StatsResponse: statsResponse,
  MoodCheckinResponse: moodCheckinResponse,
  AuthCapabilities: authCapabilitiesResponse,
  AppleChallenge: appleChallengeResponse,
  AppleExchangeResponse: appleExchangeResponse,
} as const;

/** Type alias for the component-name keys, for consumers/tests. */
export type ResponseSchemaName = keyof typeof responseSchemaRegistry;

/**
 * Registry of request-body schemas keyed by their OpenAPI component name.
 * Request models are intentionally separate from response/database rows so
 * generated clients never require server-owned fields.
 */
export const requestSchemaRegistry = {
  ActivitySeriesCreateRequest: activitySeriesCreate,
  ActivitySeriesUpdateRequest: activitySeriesUpdate,
  ActivityOccurrencePatchRequest: activityOccurrencePatch,
  TaskCreateRequest: taskCreate,
  TaskUpdateRequest: taskUpdate,
  ChecklistItemCreateRequest: checklistItemCreate,
  ChecklistItemUpdateRequest: checklistItemUpdate,
  TagCreateRequest: tagCreate,
  TagUpdateRequest: tagUpdate,
  RoutineCreateRequest: routineCreate,
  RoutineUpdateRequest: routineUpdate,
  RoutineStepCreateRequest: routineStepCreate,
  RoutineScheduleCreateRequest: routineScheduleCreate,
  UserSettingsUpdateRequest: userSettingsUpdate,
  CategoryUpdateRequest: categoryUpdate,
  FocusSessionCreateRequest: focusSessionCreateRequest,
  FocusSessionPatchRequest: focusSessionPatchRequest,
  BatchRequest: batchRequest,
  MoodCheckinRequest: moodCheckinRequest,
  AppleChallengeRequest: appleChallengeRequest,
  AppleExchangeRequest: appleExchangeRequest,
} as const;

/** Type alias for request component-name keys. */
export type RequestSchemaName = keyof typeof requestSchemaRegistry;

/**
 * Convenience type: maps each component name to its inferred TS type. Useful
 * for route handlers that want the inferred shape without re-inferring.
 */
export type ResponseSchemaRegistry = typeof responseSchemaRegistry;
export type RequestSchemaRegistry = typeof requestSchemaRegistry;
