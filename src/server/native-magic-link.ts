type MagicLinkDelivery = Readonly<{
  token: string;
  defaultUrl: string;
  metadata?: Record<string, unknown>;
}>;

export function buildMagicLinkDeliveryUrl(
  delivery: MagicLinkDelivery,
): string {
  if (delivery.metadata?.platform !== "ios") {
    return delivery.defaultUrl;
  }

  const url = new URL("/auth/callback", delivery.defaultUrl);
  url.searchParams.set("token", delivery.token);
  return url.toString();
}

export function parseMagicCallbackToken(
  value: string | string[] | undefined,
): string | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }
  return value;
}
