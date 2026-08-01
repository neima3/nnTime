export type EditorStep = { label: string; done: boolean };
export type EditorStepInput = string | { label?: unknown; done?: unknown };

export function normalizeEditorSteps(
  steps: readonly EditorStepInput[] | null | undefined,
): EditorStep[] {
  if (!steps) return [];
  return steps.flatMap((step) => {
    const label =
      typeof step === "string"
        ? step.trim()
        : typeof step.label === "string"
          ? step.label.trim()
          : "";
    if (!label) return [];
    return [{ label, done: typeof step === "object" && step.done === true }];
  });
}

export function buildChecklistTemplate(steps: readonly EditorStep[]) {
  return steps
    .filter((step) => step.label.trim().length > 0)
    .map((step) => ({ label: step.label.trim(), done: step.done }));
}
