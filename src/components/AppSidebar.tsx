import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, Plus, X, Check, Trash2, StickyNote, Target, ChevronRight } from "lucide-react";
import { useInstitution } from "@/contexts/InstitutionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInstitution, setNewInstitution] = useState({
    name: "",
    description: "",
    color: "#6366f1",
  });
  const [isCreating, setIsCreating] = useState(false);

  const { selectedInstitution, institutions, setSelectedInstitution, refreshInstitutions, deleteInstitution } = useInstitution();

  const handleDeleteInstitution = async (id: string) => {
    try {
      await deleteInstitution(id);
      toast.success(`✅ ${t('sidebar.hubDeletedSuccess')}`);
    } catch (error) {
      toast.error(`❌ ${t('sidebar.hubDeleteError')}`);
    }
  };

  const handleCreate = async () => {
    if (!newInstitution.name.trim()) {
      toast.error(`❌ ${t('sidebar.enterHubName')}`);
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

      toast.success(`✅ ${t('sidebar.hubCreatedSuccess')}`);
      setCreateDialogOpen(false);
      setNewInstitution({ name: "", description: "", color: "#6366f1" });
      await refreshInstitutions();
    } catch (error: any) {
      console.error("Error creating institution:", error);
      toast.error(`❌ ${t('sidebar.hubCreateError')}`);
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
        <SheetContent side="left" className="w-[300px] sm:w-[400px] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t('sidebar.menu')}</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6 flex-1">
            {/* Navigation Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('sidebar.navigation', 'Navegação')}
              </h3>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notes');
                }}
              >
                <div className="flex items-center gap-3">
                  <StickyNote className="h-4 w-4" />
                  <span>{t('sidebar.myNotes', 'Minhas Notas')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/goals');
                }}
              >
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4" />
                  <span>{t('sidebar.myGoals', 'Minhas Metas')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            <Separator />

            {/* Institutions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {t('sidebar.hubs')}
                </h3>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      {t('sidebar.newHub')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('sidebar.createNewHub')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">{t('sidebar.hubName')} *</Label>
                        <Input
                          id="name"
                          value={newInstitution.name}
                          onChange={(e) => setNewInstitution({ ...newInstitution, name: e.target.value })}
                          placeholder={t('sidebar.hubNamePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">
                          {t('sidebar.hubDescription')} ({t('common.optional')})
                        </Label>
                        <Textarea
                          id="description"
                          value={newInstitution.description}
                          onChange={(e) => setNewInstitution({ ...newInstitution, description: e.target.value })}
                          placeholder={t('sidebar.hubDescriptionPlaceholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="color">{t('sidebar.hubColor')}</Label>
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
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? t('sidebar.creating') : t('sidebar.createHub')}
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
                      <span className="flex-1 text-left">{t('sidebar.allNoFilter')}</span>
                      {selectedInstitution === null && <Check className="h-4 w-4" />}
                    </div>
                  </Button>

                  {institutions.map((institution) => (
                    <div key={institution.id} className="flex items-center gap-1 group">
                      <Button
                        variant={selectedInstitution?.id === institution.id ? "secondary" : "ghost"}
                        className="flex-1 justify-start"
                        onClick={() => setSelectedInstitution(institution)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: institution.color }}
                          />
                          <span className="flex-1 text-left truncate">{institution.name}</span>
                          {selectedInstitution?.id === institution.id && <Check className="h-4 w-4 shrink-0" />}
                        </div>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('sidebar.deleteHubTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('sidebar.deleteHubDescription')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteInstitution(institution.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {institutions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('sidebar.noHubsYet')}
                </p>
              )}
            </div>
          </div>

          {/* Footer with Language Switcher */}
          <div className="mt-auto pt-4">
            <Separator className="mb-4" />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('language.title')}</Label>
              <LanguageSwitcher />
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
