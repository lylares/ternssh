import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";

async function setupAccount(input: {
  username: string;
  password: string;
  confirmPassword: string;
}): Promise<void> {
  const response = await fetch("/api/v1/onboarding/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Setup failed (${response.status})`);
  }
}

export function OnboardingPage() {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("onboarding.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      await setupAccount({ username, password, confirmPassword });
      window.location.reload();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("onboarding.setupFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-lg">{t("onboarding.title")}</CardTitle>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("onboarding.description")}
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="onboarding-username">{t("onboarding.username")}</Label>
              <Input
                id="onboarding-username"
                autoComplete="username"
                value={username}
                required
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="onboarding-password">{t("onboarding.password")}</Label>
              <Input
                id="onboarding-password"
                type="password"
                autoComplete="new-password"
                value={password}
                required
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="onboarding-confirm-password">
                {t("onboarding.confirmPassword")}
              </Label>
              <Input
                id="onboarding-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                required
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? t("onboarding.submitting") : t("onboarding.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
