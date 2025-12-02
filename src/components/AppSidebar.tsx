import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, Plus, X, Check } from "lucide-react";
import { useInstitution } from "@/contexts/InstitutionContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstitution, setNewInstitution] = useState({
    name: "",
    description: "",
    color: "#6366f1",
  });
  const [isCreating, setIsCreating] = useState(false);

  const { selectedInstitution, institutions, setSelectedInstitution, refreshInstitutions } = useInstitution();

  const handleCreate = async () => {
    if (!newInstitution.name.trim()) {
      toast.error("Digite um nome para o hub");
      return;
    }

    try {
      setIsCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.from("institutions").insert({
        owner_id: session.user.id,
        name: newInstitution.name.trim(),
        description: newInstitution.description.trim() || null,
        color: newInstitution.color,
      });

      if (error) throw error;

      toast.success("✅ Hub criado com sucesso!");
      setCreateDialogOpen(false);
      setNewInstitution({ name: "", description: "", color: "#6366f1" });
      await refreshInstitutions();
    } catch (error: any) {
      console.error("Error creating institution:", error);
      toast.error("❌ Erro ao criar hub");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Institutions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Hubs / Instituições
                </h3>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Hub</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          value={newInstitution.name}
                          onChange={(e) => setNewInstitution({ ...newInstitution, name: e.target.value })}
                          placeholder="Ex: Chinês, Alemão, Inglês Kids..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Descrição (opcional)</Label>
                        <Textarea
                          id="description"
                          value={newInstitution.description}
                          onChange={(e) => setNewInstitution({ ...newInstitution, description: e.target.value })}
                          placeholder="Descreva o propósito deste hub..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="color">Cor</Label>
                        <Input
                          id="color"
                          type="color"
                          value={newInstitution.color}
                          onChange={(e) => setNewInstitution({ ...newInstitution, color: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? "Criando..." : "Criar Hub"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {/* Default (no filter) */}
                  <Button
                    variant={selectedInstitution === null ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedInstitution(null)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-3 h-3 rounded-full bg-muted" />
                      <span className="flex-1 text-left">Todos (sem filtro)</span>
                      {selectedInstitution === null && <Check className="h-4 w-4" />}
                    </div>
                  </Button>

                  {institutions.map((institution) => (
                    <Button
                      key={institution.id}
                      variant={selectedInstitution?.id === institution.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedInstitution(institution)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: institution.color }}
                        />
                        <span className="flex-1 text-left truncate">{institution.name}</span>
                        {selectedInstitution?.id === institution.id && <Check className="h-4 w-4" />}
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              {institutions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum hub criado ainda
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active institution badge */}
      {selectedInstitution && (
        <Badge
          variant="secondary"
          className="gap-2"
          style={{ borderLeft: `3px solid ${selectedInstitution.color}` }}
        >
          <Building2 className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{selectedInstitution.name}</span>
          <button
            onClick={() => setSelectedInstitution(null)}
            className="ml-1 hover:bg-background/50 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </>
  );
}
