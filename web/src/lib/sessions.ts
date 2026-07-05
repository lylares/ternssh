export type SessionStatus = "connecting" | "open" | "closed" | "error";

export interface ServerSession {
  serverId: string;
  sessionId: string;
  wsUrl: string;
  sftpWsUrl: string;
  status: SessionStatus;
  reconnectAttempt?: number;
}

export const MAX_SESSION_RECONNECT_ATTEMPTS = 3;
export const SESSION_RECONNECT_DELAY_MS = 2000;

export function isSessionAlive(status: SessionStatus | undefined): boolean {
  return status === "connecting" || status === "open";
}
