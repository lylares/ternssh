import { useEffect, useState } from "react";
import { I18nProvider } from "@/i18n";
import { SiteNameProvider } from "@/lib/site-name-context";
import { ThemeProvider } from "@/theme";
import { DashboardView } from "@/dashboard/DashboardView";
import { OnboardingPage } from "@/onboarding/OnboardingPage";

type AuthMode = "access" | "basic" | "onboarding";

async function detectAuthMode(): Promise<AuthMode> {
  const statusResponse = await fetch("/api/v1/onboarding/status");
  if (statusResponse.ok) {
    const body = (await statusResponse.json()) as { authMode: AuthMode };
    if (body.authMode === "onboarding") return "onboarding";
  }

  const meResponse = await fetch("/api/v1/me");
  if (!meResponse.ok) {
    throw new Error("Authentication required");
  }

  const body = (await meResponse.json()) as { authMode: AuthMode };
  return body.authMode;
}

function AppContent() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectAuthMode()
      .then((mode) => {
        if (!cancelled) setAuthMode(mode);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load auth status",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--color-destructive)]">
        {loadError}
      </div>
    );
  }

  if (authMode === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[var(--color-muted-foreground)]">
        …
      </div>
    );
  }

  if (authMode === "onboarding") {
    return <OnboardingPage />;
  }

  return <DashboardView />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SiteNameProvider>
        <I18nProvider>
          <div className="app-shell">
            <AppContent />
          </div>
        </I18nProvider>
      </SiteNameProvider>
    </ThemeProvider>
  );
}
