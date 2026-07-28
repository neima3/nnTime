import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { activitySeriesResponse } from "./activity-series";
import * as daySchemas from "./day";
import { responseSchemaRegistry } from "./index";

interface ObjectSchema {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
}

interface Spec {
  components?: {
    schemas?: Record<string, ObjectSchema>;
  };
}

const spec = parseYaml(
  readFileSync(resolve("api/openapi.yaml"), "utf8"),
) as Spec;

const expectedDayResponseKeys = [
  "activities",
  "anytimeTasks",
  "date",
  "end",
  "occurrenceStatusBySeries",
  "start",
  "zone",
];

describe("day OpenAPI contract", () => {
  it("models a day activity as an activity series plus occurrence identity and status", () => {
    const dayActivityResponse = (
      daySchemas as typeof daySchemas & {
        dayActivityResponse?: { shape: Record<string, unknown> };
      }
    ).dayActivityResponse;
    const expectedKeys = [
      ...Object.keys(activitySeriesResponse.shape),
      "occurrenceKey",
      "status",
    ].sort();

    expect(dayActivityResponse).toBeDefined();
    expect(Object.keys(dayActivityResponse?.shape ?? {}).sort()).toEqual(
      expectedKeys,
    );

    const activitySeries = spec.components?.schemas?.ActivitySeries;
    const dayActivity = spec.components?.schemas?.DayActivity;
    expect(dayActivity).toBeDefined();
    expect(Object.keys(dayActivity?.properties ?? {}).sort()).toEqual([
      ...Object.keys(activitySeries?.properties ?? {}),
      "occurrenceKey",
      "status",
    ].sort());
    for (const [name, schema] of Object.entries(
      activitySeries?.properties ?? {},
    )) {
      expect(dayActivity?.properties?.[name]).toEqual(schema);
    }
    expect([...(dayActivity?.required ?? [])].sort()).toEqual([
      ...(activitySeries?.required ?? []),
      "occurrenceKey",
      "status",
    ].sort());
    expect(dayActivity?.properties?.occurrenceKey).toMatchObject({
      type: "string",
      format: "date-time",
    });
    expect(dayActivity?.properties?.status).toEqual({
      $ref: "#/components/schemas/OccurrenceStatus",
    });
    expect(responseSchemaRegistry).toHaveProperty("DayActivity");
  });

  it("uses exactly the keys emitted by the day route", () => {
    expect(Object.keys(daySchemas.dayResponse.shape).sort()).toEqual(
      expectedDayResponseKeys,
    );

    const dayResponse = spec.components?.schemas?.DayResponse;
    expect(Object.keys(dayResponse?.properties ?? {}).sort()).toEqual(
      expectedDayResponseKeys,
    );
    expect([...(dayResponse?.required ?? [])].sort()).toEqual(
      expectedDayResponseKeys,
    );
    expect(dayResponse?.properties?.activities).toMatchObject({
      type: "array",
      items: { $ref: "#/components/schemas/DayActivity" },
    });
    expect(dayResponse?.properties?.occurrenceStatusBySeries).toMatchObject({
      type: "object",
      additionalProperties: {
        $ref: "#/components/schemas/OccurrenceStatus",
      },
    });
  });
});
