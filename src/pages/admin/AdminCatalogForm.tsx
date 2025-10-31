import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";

interface AdminCatalogFormProps {
  skin?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminCatalogForm({ skin, onSuccess, onCancel }: AdminCatalogFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    rarity: "normal" as "normal" | "rare" | "epic" | "legendary",
    price_pitecoin: 10,
    description: "",
    avatar_img: "",
    card_img: "",
    status: "draft" as "draft" | "preview" | "published" | "archived",
    is_active: true,
  });

  // Auto-calculate price based on rarity
  useEffect(() => {
    const rarityPrices = {
      normal: 10,
      rare: 25,
      epic: 50,
      legendary: 100,
    };
    setFormData(prev => ({ ...prev, price_pitecoin: rarityPrices[prev.rarity] }));
  }, [formData.rarity]);

  // Load existing skin data for editing
  useEffect(() => {
    if (skin) {
      setFormData({
        name: skin.name || "",
        rarity: skin.rarity || "normal",
        price_pitecoin: skin.price_pitecoin || 10,
        description: skin.description || "",
        avatar_img: skin.avatar_img || "",
        card_img: skin.card_img || "",
        status: skin.status || "draft",
        is_active: skin.is_active ?? true,
      });
    }
  }, [skin]);

  const validateImage = (url: string, type: 'avatar' | 'card'): boolean => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (!extension || !['png', 'webp'].includes(extension)) {
      toast({
        title: "Formato inválido",
        description: `${type === 'avatar' ? 'Avatar' : 'Card'} deve ser PNG ou WebP`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.avatar_img || !formData.card_img) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, avatar e card",
        variant: "destructive",
      });
      return;
    }

    if (!validateImage(formData.avatar_img, 'avatar') || !validateImage(formData.card_img, 'card')) {
      return;
    }

    setLoading(true);
    try {
      const skinId = formData.name.toLowerCase().replace(/\s+/g, '-');
      
      if (skin) {
        // Update existing skin
        const { error } = await supabase
          .from('skins_catalog')
          .update({
            name: formData.name,
            rarity: formData.rarity,
            price_pitecoin: formData.price_pitecoin,
            description: formData.description || null,
            avatar_img: formData.avatar_img,
            card_img: formData.card_img,
            status: formData.status,
            is_active: formData.is_active,
          })
          .eq('id', skin.id);

        if (error) throw error;

        await logAdminAction('update_package', formData.name, {
          rarity: formData.rarity,
          price: formData.price_pitecoin,
          status: formData.status,
        });

        toast({
          title: "✅ Skin atualizada",
          description: "As alterações foram salvas com sucesso!",
        });
      } else {
        // Create new skin
        const { error } = await supabase
          .from('skins_catalog')
          .insert({
            id: skinId,
            name: formData.name,
            rarity: formData.rarity,
            price_pitecoin: formData.price_pitecoin,
            description: formData.description || null,
            avatar_img: formData.avatar_img,
            card_img: formData.card_img,
            status: formData.status,
            is_active: formData.is_active,
          });

        if (error) throw error;

        await logAdminAction('create_package', formData.name, {
          rarity: formData.rarity,
          price: formData.price_pitecoin,
        });

        toast({
          title: "✅ Skin criada",
          description: "Pacote adicionado ao catálogo com sucesso!",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving skin:', error);
      toast({
        title: "❌ Erro",
        description: error.message || "Não foi possível salvar a skin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle>{skin ? 'Editar Skin' : 'Nova Skin'}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="rarity">Raridade</Label>
            <Select
              value={formData.rarity}
              onValueChange={(value: any) => setFormData({ ...formData, rarity: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="rare">Raro</SelectItem>
                <SelectItem value="epic">Épico</SelectItem>
                <SelectItem value="legendary">Lendário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="price">Preço (PITECOIN) - Automático por raridade</Label>
            <Input
              id="price"
              type="number"
              min="0"
              value={formData.price_pitecoin}
              onChange={(e) => setFormData({ ...formData, price_pitecoin: parseInt(e.target.value) || 0 })}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Normal: ₱10 | Raro: ₱25 | Épico: ₱50 | Lendário: ₱100
            </p>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="avatar">URL Avatar * (PNG/WebP 1024×1024)</Label>
            <Input
              id="avatar"
              value={formData.avatar_img}
              onChange={(e) => setFormData({ ...formData, avatar_img: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>

          <div>
            <Label htmlFor="card">URL Card * (PNG/WebP 1920×1080)</Label>
            <Input
              id="card"
              value={formData.card_img}
              onChange={(e) => setFormData({ ...formData, card_img: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="preview">Preview</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="active">Ativo</Label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {skin ? 'Salvar Alterações' : 'Criar Skin'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
