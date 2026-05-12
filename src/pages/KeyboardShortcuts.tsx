import { PageShell } from "@/components/layout/PageShell";
import { KeyboardShortcutsSettings } from "@/features/study/components/KeyboardShortcutsSettings";

export default function KeyboardShortcutsPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Controles do Teclado</h1>
        <KeyboardShortcutsSettings />
      </div>
    </PageShell>
  );
}