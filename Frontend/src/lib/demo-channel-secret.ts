const DEMO_CHANNEL_SECRET_KEY = "demo-channel-secret";

export function getStoredDemoChannelSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(DEMO_CHANNEL_SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredDemoChannelSecret(secret: string): void {
  if (typeof window === "undefined") return;
  try {
    if (secret) {
      sessionStorage.setItem(DEMO_CHANNEL_SECRET_KEY, secret);
    } else {
      sessionStorage.removeItem(DEMO_CHANNEL_SECRET_KEY);
    }
  } catch {
    // ignore storage errors
  }
}
