/** Display mode controls persistence only. Identity always comes from the server session. */
export function installedPanel() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}
