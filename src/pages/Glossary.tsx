import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { AccountGlossaryManager } from "@/features/study/components/AccountGlossaryManager";

export default function Glossary() {
  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Minha Caixa de Glossário" showBack />
      <main className="container mx-auto max-w-5xl space-y-4 p-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h1 className="text-xl font-semibold">Glossário central da sua conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada palavra ou expressão é armazenada uma única vez. Todas as listas atuais e futuras consultam esta mesma caixa automaticamente.
          </p>
        </div>
        <AccountGlossaryManager defaultExpanded />
      </main>
    </div>
  );
}
