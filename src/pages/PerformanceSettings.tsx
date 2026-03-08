import { usePerformance } from '@/contexts/PerformanceContext';
import { ApeAppBar } from '@/components/ape/ApeAppBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  type PerformancePreset,
  type PerformanceSettings,
} from '@/lib/performanceSettings';
import {
  Zap,
  Gauge,
  Feather,
  Volume2,
  Sparkles,
  MousePointerClick,
  MessageSquare,
  Palette,
  Eye,
  Image,
  Download,
  Activity,
  Navigation,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const presetConfig: { key: PerformancePreset; label: string; desc: string; icon: typeof Zap }[] = [
  { key: 'high', label: 'Alto', desc: 'Todos os efeitos ativados', icon: Sparkles },
  { key: 'balanced', label: 'Equilibrado', desc: 'Visual limpo, sem extras pesados', icon: Gauge },
  { key: 'light', label: 'Leve', desc: 'Máxima fluidez, mínimo de efeitos', icon: Feather },
];

type ToggleKey = keyof Omit<PerformanceSettings, 'preset'>;

const toggleConfig: { key: ToggleKey; label: string; desc: string; icon: typeof Zap }[] = [
  { key: 'soundEffects', label: 'Efeitos sonoros', desc: 'Sons nos jogos de estudo', icon: Volume2 },
  { key: 'animations', label: 'Animações de interface', desc: 'Transições de página e fade', icon: Activity },
  { key: 'hoverEffects', label: 'Efeitos de hover', desc: 'Destaque ao passar o mouse em cards', icon: MousePointerClick },
  { key: 'wordTooltips', label: 'Tooltips por palavra', desc: 'Traduções ao tocar/hover em palavras', icon: MessageSquare },
  { key: 'decorativeEffects', label: 'Efeitos decorativos', desc: 'Glow, gradientes extra, brilhos', icon: Palette },
  { key: 'visualFeedback', label: 'Feedback visual avançado', desc: 'Scale ao pressionar, micro-interações', icon: Eye },
  { key: 'highQualityImages', label: 'Imagens em alta qualidade', desc: 'Carregamento de imagens em resolução máxima', icon: Image },
  { key: 'prefetching', label: 'Pré-carregamento', desc: 'Carregar dados antecipadamente', icon: Download },
  { key: 'tabBarAnimations', label: 'Animação da barra de abas', desc: 'Indicador animado na navegação', icon: Navigation },
  { key: 'backdropBlur', label: 'Efeito de blur', desc: 'Blur de fundo no header e tab bar', icon: Layers },
  { key: 'reduceMotion', label: 'Reduzir movimento', desc: 'Menos animações, mais acessibilidade', icon: Feather },
];

const PerformanceSettingsPage = () => {
  const { settings, applyPreset, toggleSetting, currentPreset, resetToDefault } = usePerformance();

  const handlePreset = (preset: PerformancePreset) => {
    applyPreset(preset);
    toast.success(`Preset "${presetConfig.find(p => p.key === preset)?.label}" aplicado!`);
  };

  const handleReset = () => {
    resetToDefault();
    toast.success('Configurações restauradas para o padrão (Alto)');
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Desempenho" showBack backPath="/profile" />

      <div className="max-w-2xl mx-auto p-4 space-y-6 pb-32">
        {/* Presets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Qualidade visual
            </CardTitle>
            <CardDescription>Escolha um preset ou personalize abaixo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {presetConfig.map(({ key, label, desc, icon: Icon }) => {
              const isActive = currentPreset === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePreset(key)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left',
                    isActive
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{label}</span>
                      {isActive && <Badge variant="secondary" className="text-xs">Ativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
            {currentPreset === 'custom' && (
              <div className="flex items-center gap-2 px-4 py-2">
                <Badge variant="outline" className="text-xs">Personalizado</Badge>
                <span className="text-xs text-muted-foreground">Toggles customizados</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Individual Toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurações avançadas</CardTitle>
            <CardDescription>Ative ou desative recursos individualmente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {toggleConfig.map(({ key, label, desc, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 py-3 px-1"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                      {label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
                <Switch
                  id={key}
                  checked={key === 'reduceMotion' ? settings[key] : settings[key] as boolean}
                  onCheckedChange={(v) => toggleSetting(key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reset */}
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceSettingsPage;
