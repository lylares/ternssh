import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

export function AddServerDialog({
  open,
  onOpenChange,
  onCreated,
}: AddServerDialogProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<"password" | "private_key">(
    "password",
  );
  const [credential, setCredential] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName("");
    setHost("");
    setPort("22");
    setUsername("");
    setAuthType("password");
    setCredential("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createServer({
        name,
        host,
        port: Number(port),
        username,
        auth_type: authType,
        credential,
      });
      reset();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-[var(--color-card)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">添加服务器</h2>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="host">主机</Label>
              <Input
                id="host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                value={port}
                onChange={(event) => setPort(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="authType">认证方式</Label>
            <select
              id="authType"
              className="flex h-9 w-full bg-[var(--color-secondary)] px-3 text-sm"
              value={authType}
              onChange={(event) =>
                setAuthType(event.target.value as "password" | "private_key")
              }
            >
              <option value="password">密码</option>
              <option value="private_key">私钥</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="credential">
              {authType === "password" ? "密码" : "私钥内容"}
            </Label>
            {authType === "password" ? (
              <Input
                id="credential"
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                required
              />
            ) : (
              <textarea
                id="credential"
                className="min-h-28 w-full bg-[var(--color-secondary)] px-3 py-2 text-sm"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                required
              />
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
