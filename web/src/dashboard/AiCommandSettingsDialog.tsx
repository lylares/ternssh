import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import {
  DEFAULT_AI_COMMAND_CONFIG,
  parseAiCommandConfig,
  serializeAiCommandConfig,
} from "@/lib/ai-command-config";

interface AiCommandSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configJson: string | null;
  onSaved: (configJson: string) => void;
}

export function AiCommandSettingsDialog({
  open,
  onOpenChange,
  configJson,
  onSaved,
}: AiCommandSettingsDialogProps) {
  const t = useT();
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_AI_COMMAND_CONFIG.apiBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_AI_COMMAND_CONFIG.model);

  useEffect(() => {
    if (!open) return;
    const current = parseAiCommandConfig(configJson);
    setApiBaseUrl(current.apiBaseUrl);
    setApiKey(current.apiKey);
    setModel(current.model);
  }, [open, configJson]);

  if (!open) return null;

  const handleClose = () => onOpenChange(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSaved(
      serializeAiCommandConfig({
        apiBaseUrl,
        apiKey,
        model,
      }),
    );
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("ai.settingsTitle")}</h2>
        <Button variant="ghost" onClick={handleClose}>
          {t("common.close")}
        </Button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">
          {t("ai.settingsHint")}
        </p>

        <div className="grid gap-2">
          <Label htmlFor="ai-widget-api-base">{t("ai.apiBaseUrl")}</Label>
          <Input
            id="ai-widget-api-base"
            placeholder={DEFAULT_AI_COMMAND_CONFIG.apiBaseUrl}
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
          />
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            {t("ai.apiBaseUrlHint")}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ai-widget-api-key">{t("ai.apiKey")}</Label>
          <Input
            id="ai-widget-api-key"
            type="password"
            autoComplete="off"
            placeholder={t("ai.apiKeyPlaceholder")}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ai-widget-model">{t("ai.model")}</Label>
          <Input
            id="ai-widget-model"
            placeholder={DEFAULT_AI_COMMAND_CONFIG.model}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            {t("ai.modelHint")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.save")}</Button>
        </div>
      </form>
    </Modal>
  );
}
