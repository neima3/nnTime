import {
  getAuthCapabilities,
} from "@/server/auth-capabilities";

export async function GET() {
  return Response.json(getAuthCapabilities(process.env), {
    headers: {
      "cache-control": "public, no-store",
    },
  });
}
