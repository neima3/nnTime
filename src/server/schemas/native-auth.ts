import { z } from "zod";
import { instant } from "./common";

export const appleAuthIntent = z.enum(["sign_in", "link"]);

export const authCapabilitiesResponse = z
  .object({
    magicLink: z.boolean(),
    apple: z.boolean(),
  })
  .strict();

export const appleChallengeRequest = z
  .object({
    intent: appleAuthIntent,
  })
  .strict();

export const appleChallengeResponse = z
  .object({
    state: z.string().min(1),
    nonce: z.string().min(1),
    expiresAt: instant,
  })
  .strict();

export const appleExchangeRequest = z
  .object({
    intent: appleAuthIntent,
    state: z.string().min(1).max(512),
    nonce: z.string().min(1).max(512),
    idToken: z.string().min(1).max(16_384),
  })
  .strict();

export const appleExchangeResponse = z
  .object({
    redirect: z.boolean().optional(),
    token: z.string().optional(),
    url: z.string().nullable().optional(),
    status: z.boolean().optional(),
    user: z.object({}).passthrough().optional(),
  })
  .passthrough();
