import { TurmaEngagementPanel } from "./TurmaEngagementPanel";

interface TurmaActivityPanelProps {
  turmaId: string;
  membros: Array<{
    id?: string;
    user_id: string;
    profiles?: {
      first_name?: string;
      ape_id?: string;
    } | null;
  }>;
}

export function TurmaActivityPanel(props: TurmaActivityPanelProps) {
  return <TurmaEngagementPanel {...props} />;
}
