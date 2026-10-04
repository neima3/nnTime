import { getBuildProvenance } from "@/server/build-provenance";

export const dynamic = "force-dynamic";

/** Public build identity — commit SHA and build time only (no configuration dump). */
export async function GET() {
  const { commit, builtAt } = getBuildProvenance();
  return Response.json(
    {
      commit,
      builtAt,
    },
    {
      headers: { "cache-control": "no-store" },
    },
  );
}
