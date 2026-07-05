import { Button } from "@/components/ui/button";
import { useI18n, type Locale } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  const options: Array<{ value: Locale; label: string }> = [
    { value: "zh", label: t("header.langZh") },
    { value: "en", label: t("header.langEn") },
  ];

  return (
    <div className="flex w-full items-center gap-1 rounded bg-[var(--color-secondary)] p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          className={cn(
            "h-7 flex-1 px-2 text-xs",
            locale === option.value && "bg-[var(--color-card)] shadow-sm",
          )}
          size="sm"
          variant="ghost"
          onClick={() => setLocale(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
