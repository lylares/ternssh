import { I18nProvider } from "@/i18n";
import { DashboardView } from "@/dashboard/DashboardView";

export default function App() {
  return (
    <I18nProvider>
      <div className="app-shell">
        <DashboardView />
      </div>
    </I18nProvider>
  );
}
