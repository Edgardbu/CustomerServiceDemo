const DEMO_USER_ID_KEY = "demo-user-id";

export function getStoredDemoUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(DEMO_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredDemoUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.setItem(DEMO_USER_ID_KEY, userId);
    } else {
      localStorage.removeItem(DEMO_USER_ID_KEY);
    }
  } catch {
    // ignore storage errors
  }
}
