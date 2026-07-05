import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function HeaderSettingsMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="sm"
        title={t("header.settings")}
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[300] min-w-52 bg-[var(--color-card)] p-3 shadow-xl">
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-[var(--color-muted-foreground)]">
              {t("header.language")}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </div>
  );
}
