import { errorResponse, handleErrors, parseBody } from "@/server/api-errors";
import { getAuthCapabilities } from "@/server/auth-capabilities";
import { requireSession } from "@/server/auth-session";
import {
  createAppleChallenge,
  postgresAppleChallengeStore,
} from "@/server/native-apple-auth";
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/server/ratelimit";
import { appleChallengeRequest } from "@/server/schemas";
import { enforceNativeMutationOrigin } from "@/server/native-mutation-origin";

function requestIp(request: Request): string {
  // Coolify's trusted reverse proxy overwrites X-Real-IP. Never use the first
  // X-Forwarded-For hop because clients can prepend arbitrary values.
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  return handleErrors(async () => {
    if (!getAuthCapabilities(process.env).apple) {
      return errorResponse(
        "apple_unavailable",
        "Sign in with Apple is not available.",
        503,
      );
    }

    const body = await parseBody(request, appleChallengeRequest);
    if (body instanceof Response) return body;

    const ipLimit = await checkRateLimit(
      `native-apple:challenge:ip:${requestIp(request)}`,
      { limit: 10, windowSec: 60 },
    );
    if (!ipLimit.allowed) return rateLimitedResponse(ipLimit);

    let userId: string | undefined;
    if (body.intent === "link") {
      const originBlock = enforceNativeMutationOrigin(request);
      if (originBlock) return originBlock;
      ({ userId } = await requireSession());
      const userLimit = await checkRateLimit(
        `native-apple:challenge:link:user:${userId}`,
        { limit: 5, windowSec: 60 },
      );
      if (!userLimit.allowed) return rateLimitedResponse(userLimit);
    }

    const challenge = await createAppleChallenge(
      {
        intent: body.intent,
        ...(userId ? { userId } : {}),
      },
      { store: postgresAppleChallengeStore },
    );
    return Response.json(challenge, {
      status: 201,
      headers: {
        "cache-control": "private, no-store",
      },
    });
  });
}
