export type AndroidReminderStatus = {
  enabled: boolean;
  mode: "notification" | "alarm";
  notifications: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
  alarmVolume?: number;
  backgroundRestricted?: boolean;
  batteryOptimized?: boolean;
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
    | { type: "persist_session"; requestId: string }
    | { type: "connect"; mode: "notification" | "alarm" }
    | {
        type: "permission";
        permission: "notifications" | "exact" | "fullscreen" | "sound" | "battery";
      },
) {
  if (!nativeAndroid()) return false;
  window.TpecAndroid!.postMessage(JSON.stringify(command));
  return true;
}
