import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowUp,
  File,
  Folder,
  FolderPlus,
  Home,
  Link2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isSessionAlive,
  SESSION_STATUS_LABEL,
  type ServerSession,
} from "@/lib/sessions";
import {
  joinRemotePath,
  isRemoteRoot,
  parentRemotePath,
  SftpClient,
  sortSftpEntries,
  type SftpEntry,
} from "@/lib/sftp-client";
import { cn } from "@/lib/utils";

export interface FileManagerWidgetProps {
  activeServerId: string | null;
  sessions: Record<string, ServerSession>;
}

interface MenuState {
  x: number;
  y: number;
  target: { kind: "blank" } | { kind: "entry"; entry: SftpEntry };
}

function formatModifiedTime(timestamp: number): string {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString();
}

export function FileManagerWidget({
  activeServerId,
  sessions,
}: FileManagerWidgetProps) {
  const session = activeServerId ? sessions[activeServerId] : null;
  const clientRef = useRef<SftpClient | null>(null);
  const mountedRef = useRef(true);
  const [remotePath, setRemotePath] = useState(".");
  const [pathInput, setPathInput] = useState(".");
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const sortedEntries = useMemo(() => sortSftpEntries(entries), [entries]);

  const disconnectClient = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const isActive = useCallback(() => mountedRef.current, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnectClient();
    };
  }, [disconnectClient]);

  const loadDirectory = useCallback(async (path: string) => {
    if (!isActive()) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError(null);
    try {
      const result = await client.list(path);
      if (!isActive()) return;
      setRemotePath(result.path);
      setPathInput(result.path);
      setEntries(result.entries);
      setSelectedName(null);
    } catch (err) {
      if (!isActive()) return;
      setError(err instanceof Error ? err.message : "读取目录失败");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!session || session.status !== "open") {
      disconnectClient();
      if (!isActive()) return;
      setReady(false);
      setRemotePath(".");
      setPathInput(".");
      setEntries([]);
      setSelectedName(null);
      setError(null);
      setMenu(null);
      return;
    }

    const client = new SftpClient();
    clientRef.current = client;
    let cancelled = false;

    void (async () => {
      if (!isActive()) return;
      setLoading(true);
      setError(null);
      setReady(false);

      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled || !isActive()) return;

        try {
          await client.connect(session.sftpWsUrl);
          if (cancelled || !isActive()) return;
          setReady(true);
          const result = await client.list(".");
          if (cancelled || !isActive()) return;
          setRemotePath(result.path);
          setPathInput(result.path);
          setEntries(result.entries);
          setSelectedName(null);
          setLoading(false);
          return;
        } catch (err) {
          if (cancelled || !isActive()) return;
          const message = err instanceof Error ? err.message : "SFTP 连接失败";
          const retryable =
            message.includes("未就绪") ||
            message.includes("请先连接") ||
            message.includes("连接已关闭") ||
            message.includes("超时");

          if (retryable && attempt < maxAttempts - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 800));
            continue;
          }

          setError(message);
          setReady(false);
          setLoading(false);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
      client.disconnect();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [
    session?.serverId,
    session?.sessionId,
    session?.status,
    session?.sftpWsUrl,
    disconnectClient,
    isActive,
  ]);

  const navigateTo = (nextPath: string) => {
    if (!isActive() || !ready) return;
    void loadDirectory(nextPath);
  };

  const handleEntryOpen = (entry: SftpEntry) => {
    if (!isActive() || !ready) return;
    if (entry.isDir) {
      navigateTo(joinRemotePath(remotePath, entry.name));
    }
  };

  const handleMkdir = async () => {
    if (!isActive() || !ready || !clientRef.current) return;

    const name = window.prompt("新建文件夹名称");
    if (!name?.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await clientRef.current.mkdir(joinRemotePath(remotePath, name.trim()));
      if (!isActive()) return;
      await loadDirectory(remotePath);
    } catch (err) {
      if (!isActive()) return;
      setError(err instanceof Error ? err.message : "创建目录失败");
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entry: SftpEntry) => {
    if (!isActive() || !ready || !clientRef.current) return;

    const target = joinRemotePath(remotePath, entry.name);
    const label = entry.isDir ? "文件夹" : "文件";
    if (!window.confirm(`确定删除${label}「${entry.name}」？`)) return;

    setLoading(true);
    setError(null);
    setMenu(null);
    try {
      await clientRef.current.deletePath(target);
      if (!isActive()) return;
      await loadDirectory(remotePath);
    } catch (err) {
      if (!isActive()) return;
      setError(err instanceof Error ? err.message : "删除失败");
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedName) return;
    const entry = entries.find((item) => item.name === selectedName);
    if (!entry) return;
    await handleDeleteEntry(entry);
  };

  const openContextMenu = (
    event: MouseEvent,
    target: MenuState["target"],
  ) => {
    if (!ready || loading) return;
    event.preventDefault();
    event.stopPropagation();
    if (target.kind === "entry") {
      setSelectedName(target.entry.name);
    }
    setMenu({ x: event.clientX, y: event.clientY, target });
  };

  const menuItems = useMemo((): ContextMenuItem[] => {
    if (!menu || loading || !ready) return [];

    if (menu.target.kind === "blank") {
      return [
        {
          id: "mkdir",
          label: "新建文件夹",
          onSelect: () => void handleMkdir(),
        },
        {
          id: "refresh",
          label: "刷新",
          onSelect: () => void loadDirectory(remotePath),
        },
        {
          id: "up",
          label: "上级目录",
          disabled: isRemoteRoot(remotePath),
          onSelect: () => navigateTo(parentRemotePath(remotePath)),
        },
        {
          id: "home",
          label: "用户目录",
          onSelect: () => navigateTo("."),
        },
      ];
    }

    const { entry } = menu.target;
    const items: ContextMenuItem[] = [];

    if (entry.isDir) {
      items.push({
        id: "open",
        label: "打开",
        onSelect: () => navigateTo(joinRemotePath(remotePath, entry.name)),
      });
    }

    items.push({
      id: "delete",
      label: "删除",
      danger: true,
      onSelect: () => void handleDeleteEntry(entry),
    });

    return items;
  }, [menu, loading, ready, remotePath, loadDirectory]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--color-muted-foreground)]">
        选择或连接服务器以浏览远程文件
      </div>
    );
  }

  if (!isSessionAlive(session.status)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-[var(--color-muted-foreground)]">
        <span>{SESSION_STATUS_LABEL[session.status] ?? session.status}</span>
        <span>请先连接终端会话后再使用文件管理</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] p-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || !ready}
          onClick={() => navigateTo(".")}
          title="用户目录"
        >
          <Home className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || !ready || isRemoteRoot(remotePath)}
          onClick={() => navigateTo(parentRemotePath(remotePath))}
          title="上级目录"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || !ready}
          onClick={() => void loadDirectory(remotePath)}
          title="刷新"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || !ready}
          onClick={() => void handleMkdir()}
          title="新建文件夹"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || !ready || !selectedName}
          onClick={() => void handleDelete()}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            navigateTo(pathInput.trim() || ".");
          }}
        >
          <Input
            className="h-8 min-w-0 flex-1 font-mono text-xs"
            value={pathInput}
            disabled={loading || !ready}
            onChange={(event) => setPathInput(event.target.value)}
          />
        </form>
      </div>

      {error && (
        <div className="border-b border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-auto"
        onContextMenu={(event) => openContextMenu(event, { kind: "blank" })}
      >
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
            <tr>
              <th className="px-3 py-2 font-medium">名称</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">大小</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">权限</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">修改时间</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => {
              const Icon = entry.isDir ? Folder : entry.isLink ? Link2 : File;
              const selected = selectedName === entry.name;
              return (
                <tr
                  key={entry.name}
                  className={cn(
                    "cursor-pointer border-b border-[var(--color-border)]/40 hover:bg-[var(--color-secondary)]/60",
                    selected && "bg-[var(--color-secondary)]",
                  )}
                  onClick={() => setSelectedName(entry.name)}
                  onDoubleClick={() => handleEntryOpen(entry)}
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: "entry", entry })
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          entry.isDir
                            ? "text-amber-300"
                            : "text-[var(--color-muted-foreground)]",
                        )}
                      />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-[var(--color-muted-foreground)] sm:table-cell">
                    {entry.isDir ? "-" : entry.sizeFormatted}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[var(--color-muted-foreground)] md:table-cell">
                    {entry.permissions}
                  </td>
                  <td className="hidden px-3 py-2 text-[var(--color-muted-foreground)] lg:table-cell">
                    {formatModifiedTime(entry.modifiedTime)}
                  </td>
                </tr>
              );
            })}
            {!loading && ready && sortedEntries.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-[var(--color-muted-foreground)]"
                >
                  目录为空
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--color-border)] px-3 py-1.5 text-[11px] text-[var(--color-muted-foreground)]">
        {ready ? `${remotePath} · ${sortedEntries.length} 项` : "正在连接 SFTP..."}
      </div>

      <ContextMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuItems}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}
