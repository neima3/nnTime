import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { activitySeriesResponse } from "./activity-series";
import * as daySchemas from "./day";
import { responseSchemaRegistry } from "./index";
import { searchResponse } from "./search";

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

function requiredZodKeys(
  shape: Record<string, unknown>,
) {
  return Object.entries(shape)
    .filter(([, schema]) => {
      const parser = schema as {
        safeParse?: (value: unknown) => { success: boolean };
      };
      if (!parser.safeParse) {
        throw new Error("zod object shape contains a non-schema value");
      }
      return !parser.safeParse(undefined).success;
    })
    .map(([name]) => name)
    .sort();
}

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
    if (!dayActivityResponse) {
      throw new Error("dayActivityResponse is not exported");
    }
    expect(Object.keys(dayActivityResponse.shape).sort()).toEqual(
      expectedKeys,
    );

    const activitySeries = spec.components?.schemas?.ActivitySeries;
    const dayActivity = spec.components?.schemas?.DayActivity;
    expect(dayActivity).toBeDefined();
    expect(Object.keys(activitySeries?.properties ?? {}).sort()).toEqual(
      Object.keys(activitySeriesResponse.shape).sort(),
    );
    expect([...(activitySeries?.required ?? [])].sort()).toEqual(
      requiredZodKeys(activitySeriesResponse.shape),
    );
    expect(Object.keys(dayActivity?.properties ?? {}).sort()).toEqual(
      Object.keys(dayActivityResponse.shape).sort(),
    );
    expect([...(dayActivity?.required ?? [])].sort()).toEqual(
      requiredZodKeys(dayActivityResponse.shape),
    );
    for (const [name, schema] of Object.entries(
      activitySeries?.properties ?? {},
    )) {
      expect(dayActivity?.properties?.[name]).toEqual(schema);
    }
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
      propertyNames: { type: "string", format: "uuid" },
      additionalProperties: {
        $ref: "#/components/schemas/OccurrenceStatus",
      },
    });
  });

  it("keeps capped search cursors null-only in zod and OpenAPI", () => {
    const baseSearch = {
      query: "plan",
      today: "2026-07-28",
      zone: "America/New_York",
      items: [],
    };

    expect(
      searchResponse.safeParse({ ...baseSearch, nextCursor: null }).success,
    ).toBe(true);
    expect(
      searchResponse.safeParse({ ...baseSearch, nextCursor: "cursor" }).success,
    ).toBe(false);
    expect(spec.components?.schemas?.SearchResponse?.properties?.nextCursor)
      .toMatchObject({
        type: ["string", "null"],
        const: null,
      });
  });

  it("uses one exact nullable EnergyLevel component for generated clients", () => {
    for (const value of ["low", "medium", "high", null]) {
      expect(activitySeriesResponse.shape.energy.safeParse(value).success).toBe(
        true,
      );
    }
    for (const value of ["", "unknown", undefined]) {
      expect(activitySeriesResponse.shape.energy.safeParse(value).success).toBe(
        false,
      );
    }
    expect(spec.components?.schemas?.NullableEnergyLevel).toMatchObject({
      type: ["string", "null"],
      enum: ["low", "medium", "high", null],
    });
    for (const component of [
      "Task",
      "ActivitySeries",
      "ActivityOccurrence",
      "DayActivity",
    ]) {
      expect(spec.components?.schemas?.[component]?.properties?.energy).toEqual({
        $ref: "#/components/schemas/NullableEnergyLevel",
      });
      expect(spec.components?.schemas?.[component]?.required).toContain(
        "energy",
      );
    }
  });
});
