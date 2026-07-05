import { useMemo, useState, type DragEvent } from "react";
import {
  ChevronRight,
  Folder,
  GripVertical,
  Server,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  countGroupChildren,
  countTreeNodes,
  DRAG_MIME,
  flattenTree,
  isGroupDescendant,
  readDragItem,
  writeDragItem,
  type DragItem,
  type DropIntent,
} from "@/lib/server-tree";
import type { ServerListWidgetProps } from "./types";

function dropIntentKey(intent: DropIntent | null): string {
  if (!intent) return "";
  if (intent.kind === "into") return `into:${intent.groupId}`;
  return `before:${intent.parentId ?? "root"}:${intent.index}`;
}

export function ServerListWidget({
  tree,
  loading,
  moving,
  context,
  onDeleteServer,
  onDeleteGroup,
  onMoveItem,
}: ServerListWidgetProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);

  const rows = useMemo(
    () => flattenTree(tree, expanded),
    [tree, expanded],
  );
  const counts = useMemo(() => countTreeNodes(tree), [tree]);

  const toggleExpanded = (groupId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const canDrop = (item: DragItem, intent: DropIntent): boolean => {
    if (item.type === "group" && item.id === intent.groupId) return false;
    if (
      item.type === "group" &&
      intent.kind === "into" &&
      isGroupDescendant(tree, intent.groupId, item.id)
    ) {
      return false;
    }
    if (
      item.type === "group" &&
      intent.kind === "before" &&
      intent.parentId &&
      isGroupDescendant(tree, intent.parentId, item.id)
    ) {
      return false;
    }
    return true;
  };

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    item: DragItem,
  ) => {
    writeDragItem(event.dataTransfer, item);
    setDragItem(item);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropIntent(null);
  };

  const handleRootDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    const item = dragItem ?? readDragItem(event.dataTransfer);
    if (!item) return;

    const intent: DropIntent = { kind: "before", parentId: null, index: tree.length };
    if (canDrop(item, intent)) {
      event.dataTransfer.dropEffect = "move";
      setDropIntent(intent);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>, intent: DropIntent) => {
    event.preventDefault();
    event.stopPropagation();

    const item = readDragItem(event.dataTransfer) ?? dragItem;
    setDragItem(null);
    setDropIntent(null);
    if (!item || !canDrop(item, intent)) return;

    if (intent.kind === "into") {
      await onMoveItem({
        type: item.type,
        id: item.id,
        parentId: intent.groupId,
        index: countGroupChildren(tree, intent.groupId),
      });
      setExpanded((current) => new Set(current).add(intent.groupId));
      return;
    }

    await onMoveItem({
      type: item.type,
      id: item.id,
      parentId: intent.parentId,
      index: intent.index,
    });
  };

  return (
    <div
      className="widget-no-drag flex h-full flex-col overflow-auto p-3"
      onDragOver={handleRootDragOver}
      onDrop={(event) => {
        if (dropIntent?.kind === "before" && dropIntent.parentId === null) {
          void handleDrop(event, dropIntent);
        }
      }}
    >
      {loading && (
        <p className="text-sm text-[var(--color-muted-foreground)]">加载中...</p>
      )}
      {!loading && counts.servers === 0 && counts.groups === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          还没有服务器，点击添加开始。
        </p>
      )}
      {moving && (
        <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
          正在更新顺序...
        </p>
      )}

      <div className="space-y-1">
        {rows.map((row) => {
          const { node, depth, parentId, index } = row;
          const isGroup = node.type === "group";
          const isExpanded = isGroup && expanded.has(node.id);
          const selected =
            !isGroup && context.selectedServerId === node.id;
          const beforeIntent: DropIntent = {
            kind: "before",
            parentId,
            index,
          };
          const intoIntent: DropIntent = isGroup
            ? { kind: "into", groupId: node.id }
            : beforeIntent;
          const showBeforeDrop =
            dropIntent && dropIntentKey(dropIntent) === dropIntentKey(beforeIntent);
          const showIntoDrop =
            isGroup &&
            dropIntent &&
            dropIntentKey(dropIntent) === dropIntentKey(intoIntent);

          return (
            <div key={`${node.type}:${node.id}`}>
              <div
                className={cn(
                  "relative h-1 transition-colors",
                  showBeforeDrop && "bg-[var(--color-primary)]",
                )}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const item = dragItem ?? readDragItem(event.dataTransfer);
                  if (!item || !canDrop(item, beforeIntent)) return;
                  event.dataTransfer.dropEffect = "move";
                  setDropIntent(beforeIntent);
                }}
                onDrop={(event) => void handleDrop(event, beforeIntent)}
              />

              <div
                className={cn(
                  "transition-colors",
                  selected && "bg-[var(--color-secondary)]",
                  showIntoDrop && "bg-[var(--color-secondary)]/60",
                )}
                style={{ marginLeft: depth * 14 }}
                onDragOver={
                  isGroup
                    ? (event) => {
                        if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const item = dragItem ?? readDragItem(event.dataTransfer);
                        if (!item || !canDrop(item, intoIntent)) return;
                        event.dataTransfer.dropEffect = "move";
                        setDropIntent(intoIntent);
                      }
                    : undefined
                }
                onDrop={
                  isGroup
                    ? (event) => void handleDrop(event, intoIntent)
                    : undefined
                }
              >
                <div className="flex items-start gap-1 p-2">
                  <button
                    type="button"
                    className="widget-no-drag mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)] active:cursor-grabbing"
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, {
                        type: isGroup ? "group" : "server",
                        id: node.id,
                      })
                    }
                    onDragEnd={handleDragEnd}
                    aria-label="拖拽排序"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  {isGroup ? (
                    <button
                      type="button"
                      className="widget-no-drag mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center hover:bg-[var(--color-secondary)]"
                      onClick={() => toggleExpanded(node.id)}
                      aria-label={isExpanded ? "收起分组" : "展开分组"}
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isExpanded && "rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                      <Server className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {isGroup ? (
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate font-medium">
                            <Folder className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                            <span className="truncate">{node.name}</span>
                          </div>
                          <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                            {node.children.length} 项
                          </div>
                        </div>
                        <Button
                          className="widget-no-drag"
                          size="icon"
                          variant="ghost"
                          onClick={() => onDeleteGroup(node.id)}
                          aria-label={`删除分组 ${node.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            className="widget-no-drag min-w-0 flex-1 text-left"
                            onClick={() => context.onSelectServer(node.id)}
                          >
                            <div className="truncate font-medium">{node.name}</div>
                            <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                              {node.username}@{node.host}:{node.port}
                            </div>
                          </button>
                          <Button
                            className="widget-no-drag"
                            size="icon"
                            variant="ghost"
                            onClick={() => onDeleteServer(node.id)}
                            aria-label={`删除 ${node.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge>{node.auth_type}</Badge>
                          <Button
                            className="widget-no-drag"
                            size="sm"
                            variant="secondary"
                            onClick={() => context.onConnectServer(node.id)}
                          >
                            连接
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {dragItem && (
          <div
            className={cn(
              "mt-1 h-8 text-center text-xs leading-8 text-[var(--color-muted-foreground)]",
              dropIntent?.kind === "before" &&
                dropIntent.parentId === null &&
                dropIntent.index === tree.length &&
                "bg-[var(--color-secondary)] text-[var(--color-primary)]",
            )}
            onDragOver={handleRootDragOver}
            onDrop={(event) => {
              const intent: DropIntent = {
                kind: "before",
                parentId: null,
                index: tree.length,
              };
              void handleDrop(event, intent);
            }}
          >
            拖到此处移至根目录
          </div>
        )}
      </div>
    </div>
  );
}
