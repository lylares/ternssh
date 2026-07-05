import type { ReactNode } from "react";
import { HeaderSettingsMenu } from "@/components/HeaderSettingsMenu";

interface WorkspaceHeaderProps {
  actions?: ReactNode;
}

export function WorkspaceHeader({ actions }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div className="app-brand">ternssh</div>
      <div className="app-header-actions">
        {actions}
        <HeaderSettingsMenu />
      </div>
    </header>
  );
}
