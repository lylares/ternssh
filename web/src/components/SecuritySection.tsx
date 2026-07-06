import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { logoutBasicAuth } from "@/lib/basic-auth";

export function SecuritySection() {
  const t = useT();
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .getAuthCredentials()
      .then((response) => {
        if (!cancelled) setUsername(response.username);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("security.loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError(t("security.passwordMismatch"));
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateAuthCredentials({
        currentPassword,
        username,
        newPassword: newPassword || undefined,
        confirmPassword: newPassword ? confirmPassword : undefined,
      });
      setUsername(result.username);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(t("security.updateSuccessRelogin"));
      window.setTimeout(() => {
        logoutBasicAuth();
      }, 1200);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("security.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setLoggingOut(true);
    logoutBasicAuth();
  };

  if (loading) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t("security.loading")}
      </p>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold">{t("header.settingsSecurity")}</h3>
        <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t("header.settingsSecurityHint")}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="security-username">{t("security.username")}</Label>
          <Input
            id="security-username"
            autoComplete="username"
            value={username}
            required
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-current-password">
            {t("security.currentPassword")}
          </Label>
          <Input
            id="security-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            required
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="security-new-password">{t("security.newPassword")}</Label>
          <Input
            id="security-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            minLength={8}
            placeholder={t("security.newPasswordHint")}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        {newPassword && (
          <div className="grid gap-2">
            <Label htmlFor="security-confirm-password">
              {t("security.confirmPassword")}
            </Label>
            <Input
              id="security-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              required
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-destructive)]">{error}</p>
        )}
        {success && (
          <p className="text-sm text-[var(--color-success)]">{success}</p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? t("security.saving") : t("security.saveChanges")}
        </Button>
      </form>

      <div className="border-t border-[var(--color-border)] pt-6">
        <h3 className="text-sm font-semibold">{t("security.logoutTitle")}</h3>
        <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
          {t("security.logoutHint")}
        </p>
        <Button
          className="mt-3"
          variant="secondary"
          disabled={loggingOut}
          onClick={handleLogout}
        >
          {loggingOut ? t("security.loggingOut") : t("security.logout")}
        </Button>
      </div>
    </section>
  );
}
