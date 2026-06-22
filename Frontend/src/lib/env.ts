export function getApiUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local",
    );
  }

  return base.replace(/\/$/, "");
}

export function getWsUrl(tenantId: string): string {
  const httpUrl = getApiUrl();
  const wsBase = httpUrl.replace(/^http/i, "ws");
  return `${wsBase}/api/v1/ws?tenant_id=${encodeURIComponent(tenantId)}`;
}
