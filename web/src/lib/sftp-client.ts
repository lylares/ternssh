export interface SftpEntry {
  name: string;
  type: "dir" | "file" | "link";
  size: number;
  sizeFormatted: string;
  permissions: string;
  permissionsRaw: number;
  modifiedTime: number;
  isDir: boolean;
  isLink: boolean;
}

export type SftpClientStatus =
  | "idle"
  | "connecting"
  | "initializing"
  | "ready"
  | "error"
  | "closed";

interface Waiter {
  match: (message: Record<string, unknown>) => boolean;
  resolve: (message: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: number;
}

function wsUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export class SftpClient {
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private closed = false;
  private intentionalClose = false;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(path: string): Promise<void> {
    this.disconnect();
    this.closed = false;
    this.intentionalClose = false;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl(path));
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("SFTP WebSocket 连接失败"));
      ws.onclose = () => {
        this.closed = true;
        if (!this.intentionalClose) {
          this.rejectAll(new Error("SFTP 连接已关闭"));
        } else {
          this.clearWaiters();
        }
        this.ws = null;
      };
      ws.onmessage = (event) => {
        void this.handleMessage(event.data);
      };
    });

    await this.waitFor(
      (message) => message.type === "sftp_socket_ready",
      30_000,
      "等待 SFTP 通道超时",
    );

    this.send({ type: "sftp_init" });

    for (let attempt = 0; attempt < 20; attempt++) {
      const message = await this.waitFor(
        (item) => item.type === "sftp_ready" || item.type === "sftp_error",
        10_000,
        "SFTP 初始化超时",
      );

      if (message.type === "sftp_ready") {
        return;
      }

      const reason = String(message.message ?? "SFTP 初始化失败");
      if (reason.includes("未就绪") && attempt < 19) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        this.send({ type: "sftp_init" });
        continue;
      }

      throw new Error(reason);
    }
  }

  async list(path: string): Promise<{ path: string; entries: SftpEntry[] }> {
    this.send({ type: "sftp_list", path });
    const message = await this.waitFor(
      (item) => item.type === "sftp_list_result" || item.type === "sftp_error",
      20_000,
      "列出目录超时",
    );

    if (message.type === "sftp_error") {
      throw new Error(String(message.message ?? "列出目录失败"));
    }

    return {
      path: String(message.path ?? path),
      entries: (message.entries as SftpEntry[] | undefined) ?? [],
    };
  }

  async mkdir(path: string): Promise<void> {
    this.send({ type: "sftp_mkdir", path });
    const message = await this.waitFor(
      (item) =>
        item.type === "sftp_mkdir_result" ||
        item.type === "sftp_error",
      15_000,
      "创建目录超时",
    );

    if (message.type === "sftp_error") {
      throw new Error(String(message.message ?? "创建目录失败"));
    }
  }

  async deletePath(path: string): Promise<void> {
    this.send({ type: "sftp_delete", path });
    const message = await this.waitFor(
      (item) =>
        item.type === "sftp_delete_result" ||
        item.type === "sftp_error",
      15_000,
      "删除超时",
    );

    if (message.type === "sftp_error") {
      throw new Error(String(message.message ?? "删除失败"));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.closed = true;
    this.clearWaiters();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "sftp_close" }));
        }
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("SFTP 未连接");
    }
    this.ws.send(JSON.stringify(payload));
  }

  private async handleMessage(data: string | Blob | ArrayBuffer): Promise<void> {
    if (typeof data !== "string") return;

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = message.type;
    if (typeof type !== "string") return;

    if (type === "sftp_closed") {
      if (!this.intentionalClose && this.ws) {
        this.rejectAll(new Error(String(message.message ?? "SFTP 通道已关闭")));
        try {
          this.ws.close();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (type === "sftp_error") {
      const waiter = this.waiters.find((item) => item.match(message));
      if (waiter) {
        this.removeWaiter(waiter);
        waiter.reject(
          new Error(String(message.message ?? "SFTP 操作失败")),
        );
      }
      return;
    }

    const waiterIndex = this.waiters.findIndex((item) => item.match(message));
    if (waiterIndex >= 0) {
      const waiter = this.waiters[waiterIndex];
      this.removeWaiter(waiter);
      waiter.resolve(message);
    }
  }

  private waitFor(
    match: (message: Record<string, unknown>) => boolean,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<Record<string, unknown>> {
    if (this.closed) {
      return Promise.reject(new Error("SFTP 已断开"));
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.removeWaiter(waiter);
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      const waiter: Waiter = { match, resolve, reject, timer };
      this.waiters.push(waiter);
    });
  }

  private removeWaiter(waiter: Waiter): void {
    window.clearTimeout(waiter.timer);
    this.waiters = this.waiters.filter((item) => item !== waiter);
  }

  private rejectAll(error: Error): void {
    for (const waiter of this.waiters) {
      window.clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters = [];
  }

  private clearWaiters(): void {
    for (const waiter of this.waiters) {
      window.clearTimeout(waiter.timer);
    }
    this.waiters = [];
  }
}

export function joinRemotePath(base: string, name: string): string {
  if (base === "." || base === "") return name;
  if (base.endsWith("/")) return `${base}${name}`;
  return `${base}/${name}`;
}

export function parentRemotePath(path: string): string {
  if (path === "." || path === "/") return path;

  const isAbsolute = path.startsWith("/");
  const parts = path.split("/").filter(Boolean);
  parts.pop();

  if (parts.length === 0) {
    return isAbsolute ? "/" : ".";
  }

  const joined = parts.join("/");
  return isAbsolute ? `/${joined}` : joined;
}

export function isRemoteRoot(path: string): boolean {
  return path === "." || path === "/";
}

export function sortSftpEntries(entries: SftpEntry[]): SftpEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
