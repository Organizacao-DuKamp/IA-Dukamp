export type AndroidReminderStatus = {
  enabled: boolean;
  mode: "notification" | "alarm";
  notifications: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
  pushAvailable: boolean;
  pushConfigured: boolean;
  scheduled: number;
  hasMore?: boolean;
  lastSync?: string;
  error?: string;
};
declare global {
  interface Window {
    TpecAndroid?: { postMessage(message: string): void };
  }
}
export function nativeAndroid() {
  return typeof window !== "undefined" && typeof window.TpecAndroid?.postMessage === "function";
}
export function androidCommand(
  command:
    | { type: "status" | "sync" | "disconnect" | "test" }
    | { type: "connect"; mode: "notification" | "alarm" }
    | { type: "permission"; permission: "notifications" | "exact" | "fullscreen" },
) {
  if (!nativeAndroid()) return false;
  window.TpecAndroid!.postMessage(JSON.stringify(command));
  return true;
}
