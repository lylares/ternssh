import { useCallback, useMemo, useState } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import {
  parseQuickCommandsConfig,
  serializeQuickCommandsConfig,
  type QuickCommandItem,
} from "@/lib/quick-commands-config";
import { isSessionAlive, type ServerSession } from "@/lib/sessions";
import { runTerminalCommand } from "@/lib/terminal-bridge";
import { cn } from "@/lib/utils";

export interface QuickCommandsWidgetProps {
  activeServerId: string | null;
  sessions: Record<string, ServerSession>;
  configJson: string | null;
  onConfigChange: (configJson: string) => void;
}

interface PresetCommand {
  label?: string;
  labelKey?: string;
  command: string;
}

interface PresetCommandGroup {
  titleKey: string;
  commands: PresetCommand[];
}

const PRESET_GROUPS: PresetCommandGroup[] = [
  {
    titleKey: "quickCommands.preset.system",
    commands: [
      { label: "uptime", command: "uptime" },
      { label: "whoami", command: "whoami" },
      { label: "pwd", command: "pwd" },
    ],
  },
  {
    titleKey: "quickCommands.preset.resources",
    commands: [
      { labelKey: "disk", command: "df -h" },
      { labelKey: "memory", command: "free -h" },
    ],
  },
  {
    titleKey: "quickCommands.preset.processes",
    commands: [
      { labelKey: "topMem", command: "ps aux --sort=-%mem | head -10" },
      { labelKey: "topCpu", command: "ps aux --sort=-%cpu | head -10" },
    ],
  },
  {
    titleKey: "quickCommands.preset.docker",
    commands: [
      { labelKey: "containers", command: "docker ps" },
      {
        labelKey: "compose",
        command: "docker compose ps 2>/dev/null || docker-compose ps",
      },
    ],
  },
  {
    titleKey: "quickCommands.preset.network",
    commands: [
      {
        labelKey: "ports",
        command: "ss -tlnp 2>/dev/null || netstat -tlnp",
      },
    ],
  },
  {
    titleKey: "quickCommands.preset.logs",
    commands: [
      {
        labelKey: "recentLogs",
        command:
          "journalctl -n 50 --no-pager 2>/dev/null || tail -n 50 /var/log/syslog 2>/dev/null || dmesg | tail -n 50",
      },
    ],
  },
];

function sessionStatusLabel(
  t: (key: string) => string,
  status: ServerSession["status"] | undefined,
): string {
  if (!status) return t("common.idle");
  return t(`session.${status}`);
}

export function QuickCommandsWidget({
  activeServerId,
  sessions,
  configJson,
  onConfigChange,
}: QuickCommandsWidgetProps) {
  const t = useT();
  const session = activeServerId ? sessions[activeServerId] : null;
  const alive = session ? isSessionAlive(session.status) : false;
  const customCommands = useMemo(
    () => parseQuickCommandsConfig(configJson).customCommands,
    [configJson],
  );
  const [lastRunKey, setLastRunKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveCustomCommands = useCallback(
    (next: QuickCommandItem[]) => {
      onConfigChange(
        serializeQuickCommandsConfig({ customCommands: next }),
      );
    },
    [onConfigChange],
  );

  const handleRun = useCallback(
    (key: string, command: string) => {
      if (!activeServerId) {
        setError(t("quickCommands.selectServerFirst"));
        return;
      }
      if (!alive) {
        setError(
          t("quickCommands.terminalNotConnected", {
            status: sessionStatusLabel(t, session?.status),
          }),
        );
        return;
      }

      const ok = runTerminalCommand(activeServerId, command);
      if (!ok) {
        setError(t("quickCommands.sendFailed"));
        return;
      }

      setError(null);
      setLastRunKey(key);
      window.setTimeout(() => setLastRunKey(null), 1200);
    },
    [activeServerId, alive, session?.status, t],
  );

  const handleDelete = useCallback(
    (id: string) => {
      saveCustomCommands(customCommands.filter((item) => item.id !== id));
    },
    [customCommands, saveCustomCommands],
  );

  const presetCommandLabel = (command: PresetCommand) =>
    command.labelKey
      ? t(`quickCommands.preset.${command.labelKey}`)
      : (command.label ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-start gap-2 text-[11px] text-[var(--color-muted-foreground)]">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{t("quickCommands.hint")}</p>
      </div>

      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
          {error}
        </p>
      )}

      {!activeServerId && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("quickCommands.noServer")}
        </p>
      )}

      {activeServerId && !alive && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("quickCommands.terminalStatus", {
            status: sessionStatusLabel(t, session?.status),
          })}
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium text-[var(--color-muted-foreground)]">
          {t("quickCommands.myCommands")}
        </h3>

        {customCommands.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {customCommands.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <Button
                  className={cn(
                    "h-7 min-w-0 flex-1 justify-start px-2.5 text-xs",
                    lastRunKey === item.id &&
                      "ring-1 ring-[var(--color-primary)]",
                  )}
                  disabled={!alive}
                  size="sm"
                  title={item.command}
                  variant="secondary"
                  onClick={() => handleRun(item.id, item.command)}
                >
                  <span className="truncate">{item.label}</span>
                </Button>
                <Button
                  className="widget-no-drag h-7 w-7 shrink-0 px-0"
                  size="sm"
                  title={t("quickCommands.deleteTitle")}
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            {t("quickCommands.empty")}
          </p>
        )}
      </section>

      <div className="space-y-3">
        {PRESET_GROUPS.map((group) => (
          <section key={group.titleKey} className="space-y-1.5">
            <h3 className="text-[11px] font-medium text-[var(--color-muted-foreground)]">
              {t(group.titleKey)}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {group.commands.map((command) => {
                const label = presetCommandLabel(command);
                const key = `preset:${group.titleKey}:${label}`;
                return (
                  <Button
                    key={key}
                    className={cn(
                      "h-7 px-2.5 text-xs",
                      lastRunKey === key &&
                        "ring-1 ring-[var(--color-primary)]",
                    )}
                    disabled={!alive}
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRun(key, command.command)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
