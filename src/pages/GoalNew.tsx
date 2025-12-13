import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, Trash2, Target, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGoals } from "@/hooks/useGoals";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ListOption {
  id: string;
  title: string;
  folder_title: string;
}

interface StepDraft {
  id: string;
  list_id: string;
  mode: string | null;
  target_count: number;
}

const MODES = [
  { value: 'free', label: 'Modo livre (qualquer)' },
  { value: 'flip', label: 'Virar Cartas' },
  { value: 'write', label: 'Escrever' },
  { value: 'multiple-choice', label: 'Múltipla Escolha' },
  { value: 'unscramble', label: 'Desembaralhar' },
  { value: 'pronunciation', label: 'Pronúncia' },
  { value: 'mixed', label: 'Misto' },
];

const DUE_OPTIONS = [
  { value: 'none', label: 'Sem prazo' },
  { value: '3', label: '3 dias' },
  { value: '7', label: '1 semana' },
  { value: '14', label: '2 semanas' },
  { value: '30', label: '1 mês' },
];

export default function GoalNew() {
  const navigate = useNavigate();
  const { createGoal } = useGoals();

  const [title, setTitle] = useState("");
  const [dueDays, setDueDays] = useState<string>("none");
  const [steps, setSteps] = useState<StepDraft[]>([
    { id: crypto.randomUUID(), list_id: '', mode: 'free', target_count: 1 }
  ]);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user's lists
  useEffect(() => {
    async function fetchLists() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch lists with folder info
        const { data: listsData, error } = await supabase
          .from('lists')
          .select(`
            id,
            title,
            folders!inner(title)
          `)
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const formattedLists = (listsData || []).map(l => ({
          id: l.id,
          title: l.title,
          folder_title: (l.folders as any)?.title || 'Pasta'
        }));

        setLists(formattedLists);
      } catch (error) {
        console.error('Error fetching lists:', error);
        toast.error('Erro ao carregar listas');
      } finally {
        setIsLoadingLists(false);
      }
    }

    fetchLists();
  }, []);

  const addStep = () => {
    setSteps([...steps, { 
      id: crypto.randomUUID(), 
      list_id: '', 
      mode: 'free', 
      target_count: 1 
    }]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) {
      toast.error('A meta precisa ter pelo menos 1 etapa');
      return;
    }
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, field: keyof StepDraft, value: any) => {
    setSteps(steps.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast.error('Digite um nome para a meta');
      return;
    }

    const validSteps = steps.filter(s => s.list_id);
    if (validSteps.length === 0) {
      toast.error('Adicione pelo menos uma etapa com lista');
      return;
    }

    try {
      setIsSubmitting(true);

      const goalId = await createGoal({
        title: title.trim(),
        due_days: dueDays !== 'none' ? parseInt(dueDays) : null,
        steps: validSteps.map(s => ({
          list_id: s.list_id,
          mode: s.mode === 'free' ? null : s.mode,
          target_count: s.target_count
        }))
      });

      if (goalId) {
        navigate('/goals');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <ApeAppBar title="Nova Meta" showBack />

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Nome da meta *</Label>
              <Input
                id="title"
                placeholder="Ex: Revisar vocabulário de viagem"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="due">Prazo (opcional)</Label>
              <Select value={dueDays} onValueChange={setDueDays}>
                <SelectTrigger id="due">
                  <SelectValue placeholder="Sem prazo" />
                </SelectTrigger>
                <SelectContent>
                  {DUE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Etapas</CardTitle>
              <Button variant="outline" size="sm" onClick={addStep} className="gap-1">
                <Plus className="h-3 w-3" />
                Etapa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingLists ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando listas...
              </div>
            ) : lists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Você ainda não tem listas.</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/folders')}
                  className="mt-2"
                >
                  Criar uma lista primeiro
                </Button>
              </div>
            ) : (
              steps.map((step, index) => (
                <div 
                  key={step.id}
                  className="p-3 rounded-lg border bg-muted/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Etapa {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {/* List select */}
                    <div>
                      <Label className="text-xs">Lista *</Label>
                      <Select 
                        value={step.list_id} 
                        onValueChange={(v) => updateStep(step.id, 'list_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher lista" />
                        </SelectTrigger>
                        <SelectContent>
                          {lists.map(list => (
                            <SelectItem key={list.id} value={list.id}>
                              <div className="flex flex-col items-start">
                                <span>{list.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {list.folder_title}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Mode */}
                      <div>
                        <Label className="text-xs">Modo</Label>
                        <Select 
                          value={step.mode || 'free'} 
                          onValueChange={(v) => updateStep(step.id, 'mode', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Modo livre" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODES.map(mode => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Repetitions */}
                      <div>
                        <Label className="text-xs">Repetições</Label>
                        <Select 
                          value={String(step.target_count)} 
                          onValueChange={(v) => updateStep(step.id, 'target_count', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 vez</SelectItem>
                            <SelectItem value="2">2 vezes</SelectItem>
                            <SelectItem value="3">3 vezes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border p-3 z-40">
        <div className="container max-w-2xl mx-auto">
          <Button 
            className="w-full gap-2" 
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || steps.every(s => !s.list_id)}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Criar Meta
          </Button>
        </div>
      </div>
    </div>
  );
}
