export function shouldExposeInternalReferenceRoute(
  nodeEnv: string | undefined,
): boolean {
  return nodeEnv !== "production";
}
