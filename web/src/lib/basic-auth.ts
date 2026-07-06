export function logoutBasicAuth(): void {
  void fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${Date.now()}:logout`)}`,
    },
  }).finally(() => {
    window.location.assign("/");
  });
}
