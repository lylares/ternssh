import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useI18n } from "@/i18n";
import { usePersonalization, type TerminalThemeColors } from "@/theme";
import {
  MAX_SESSION_RECONNECT_ATTEMPTS,
  type ServerSession,
} from "@/lib/sessions";
import { registerTerminalRunner } from "@/lib/terminal-bridge";
import { cn } from "@/lib/utils";
import type { TerminalWidgetProps } from "./types";
import "@xterm/xterm/css/xterm.css";

function decodeWsPayload(data: string | Blob | ArrayBuffer): string | Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (data instanceof Blob) {
    return data.text();
  }
  return String(data);
}

function parseControlMessage(
  data: string,
  t: (key: string) => string,
): {
  kind: "ignore" | "error" | "ready";
  message?: string;
} | null {
  if (!data.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(data) as { type?: string; message?: string };
    if (parsed.type === "error") {
      return { kind: "error", message: parsed.message ?? t("session.connectFailed") };
    }
    if (
      parsed.type === "status" &&
      (parsed.message?.includes("Shell 已就绪") ||
        parsed.message?.includes("Shell ready") ||
        parsed.message?.includes("认证成功") ||
        parsed.message?.includes("authenticated"))
    ) {
      return { kind: "ready" };
    }
    return { kind: "ignore" };
  } catch {
    return null;
  }
}

interface SessionPaneProps {
  session: ServerSession;
  active: boolean;
  onStatusChange: (status: ServerSession["status"]) => void;
  onClosed: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  terminalColors: TerminalThemeColors;
}

function SessionPane({
  session,
  active,
  onStatusChange,
  onClosed,
  t,
  terminalColors,
}: SessionPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const runCommandRef = useRef<(command: string) => boolean>(() => false);
  const onStatusChangeRef = useRef(onStatusChange);
  const onClosedRef = useRef(onClosed);
  onStatusChangeRef.current = onStatusChange;
  onClosedRef.current = onClosed;

  useEffect(() => {
    return registerTerminalRunner(session.serverId, (command) =>
      runCommandRef.current(command),
    );
  }, [session.serverId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      convertEol: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      theme: {
        ...terminalColors,
        background: "#00000000",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [session.serverId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = {
      ...terminalColors,
      background: "#00000000",
    };
  }, [terminalColors]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}${session.wsUrl}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    onStatusChangeRef.current("connecting");
    terminal.reset();
    if (session.reconnectAttempt && session.reconnectAttempt > 0) {
      terminal.writeln(
        t("session.reconnecting", {
          current: session.reconnectAttempt,
          max: MAX_SESSION_RECONNECT_ATTEMPTS,
        }),
      );
    } else {
      terminal.writeln(t("session.connectingSsh"));
    }

    let disposed = false;

    const sendResize = () => {
      const fitAddon = fitAddonRef.current;
      const term = terminalRef.current;
      if (!fitAddon || !term || ws.readyState !== WebSocket.OPEN) return;
      fitAddon.fit();
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }),
      );
    };

    runCommandRef.current = (command: string) => {
      const term = terminalRef.current;
      const currentWs = wsRef.current;
      if (!term || !currentWs || currentWs.readyState !== WebSocket.OPEN) {
        return false;
      }
      const normalized = command.replace(/\r\n/g, "\n");
      term.write(`${normalized.replace(/\n/g, "\r\n")}\r\n`);
      currentWs.send(`${normalized}\n`);
      return true;
    };

    ws.onopen = () => {
      onStatusChangeRef.current("open");
      sendResize();
    };

    ws.onclose = () => {
      if (disposed) return;
      terminal.writeln(`\r\n${t("session.disconnected")}`);
      onClosedRef.current();
    };

    ws.onerror = () => {
      if (disposed) return;
      onStatusChangeRef.current("error");
      terminal.writeln(`\r\n${t("session.wsFailed")}`);
    };

    let ready = false;
    ws.onmessage = (event) => {
      void (async () => {
        const data = await decodeWsPayload(event.data);
        const control = parseControlMessage(data, t);
        if (control) {
          if (control.kind === "error") {
            onStatusChangeRef.current("error");
            terminal.writeln(`\r\n${control.message ?? t("session.connectFailed")}`);
            return;
          }
          if (control.kind === "ready" && !ready) {
            ready = true;
            terminal.reset();
            sendResize();
            return;
          }
          return;
        }
        terminal.write(data);
      })();
    };

    const onData = terminal.onData((input) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(input);
      }
    });

    return () => {
      disposed = true;
      onData.dispose();
      ws.close();
      wsRef.current = null;
      runCommandRef.current = () => false;
    };
  }, [session.reconnectAttempt, session.serverId, session.wsUrl, t]);

  useEffect(() => {
    if (!active) return;
    const fitAddon = fitAddonRef.current;
    const ws = wsRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon || !terminal) return;

    fitAddon.fit();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        }),
      );
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "terminal-widget-host absolute inset-0 overflow-hidden p-1",
        !active && "invisible pointer-events-none",
      )}
    />
  );
}

export function TerminalWidget({
  sessions,
  activeServerId,
  onSessionStatusChange,
  onSessionClosed,
  onStatusChange,
}: TerminalWidgetProps) {
  const { t } = useI18n();
  const { resolvedTerminalColors } = usePersonalization();
  const activeSession = sessions.find(
    (session) => session.serverId === activeServerId,
  );

  useEffect(() => {
    onStatusChange?.(activeSession?.status ?? "idle");
  }, [activeSession?.status, onStatusChange]);

  return (
    <div className="relative flex h-full min-h-0 flex-col p-3">
      {sessions.length === 0 && (
        <p className="mb-2 text-sm text-[var(--color-muted-foreground)]">
          {t("terminal.emptyHint")}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => (
          <SessionPane
            key={`${session.serverId}:${session.sessionId}`}
            active={session.serverId === activeServerId}
            terminalColors={resolvedTerminalColors}
            session={session}
            t={t}
            onClosed={() => onSessionClosed(session.serverId)}
            onStatusChange={(status) =>
              onSessionStatusChange(session.serverId, status)
            }
          />
        ))}
      </div>
    </div>
  );
}
