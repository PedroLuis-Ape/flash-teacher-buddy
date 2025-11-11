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
import { Loader2, ArrowLeft, Upload, X } from "lucide-react";
import { logAdminAction } from "@/lib/adminLogger";

interface AdminCatalogFormProps {
  skin?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminCatalogForm({ skin, onSuccess, onCancel }: AdminCatalogFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'card' | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
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

  const handleFileSelect = async (file: File, type: 'avatar' | 'card') => {
    // Validate file type
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use PNG, WebP ou JPEG",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      toast({
        title: "Arquivo muito grande",
        description: "Tamanho máximo: 5MB",
        variant: "destructive",
      });
      return;
    }

    if (type === 'avatar') {
      setAvatarFile(file);
    } else {
      setCardFile(file);
    }
  };

  const uploadImage = async (file: File, type: 'avatar' | 'card'): Promise<string | null> => {
    setUploading(type);
    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.name.toLowerCase().replace(/\s+/g, '-')}_${type}_${timestamp}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('skins')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('skins')
        .getPublicUrl(filePath);

      toast({
        title: "✅ Upload concluído",
        description: `${type === 'avatar' ? 'Avatar' : 'Card'} enviado com sucesso!`,
      });

      return publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "❌ Erro no upload",
        description: error.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Nome obrigatório",
        description: "Preencha o nome da skin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = formData.avatar_img;
      let cardUrl = formData.card_img;

      // Upload avatar if new file selected
      if (avatarFile) {
        const url = await uploadImage(avatarFile, 'avatar');
        if (!url) {
          setLoading(false);
          return;
        }
        avatarUrl = url;
      }

      // Upload card if new file selected
      if (cardFile) {
        const url = await uploadImage(cardFile, 'card');
        if (!url) {
          setLoading(false);
          return;
        }
        cardUrl = url;
      }

      // Check if both images are present
      if (!avatarUrl || !cardUrl) {
        toast({
          title: "Imagens obrigatórias",
          description: "Envie avatar e card",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
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
            avatar_img: avatarUrl,
            card_img: cardUrl,
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
            avatar_img: avatarUrl,
            card_img: cardUrl,
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

          <div className="space-y-2">
            <Label>Avatar * (PNG/WebP/JPG - 1024×1024)</Label>
            {formData.avatar_img && !avatarFile && (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                <img src={formData.avatar_img} alt="Avatar atual" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => setFormData({ ...formData, avatar_img: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {avatarFile && (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                <img src={URL.createObjectURL(avatarFile)} alt="Novo avatar" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => setAvatarFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, 'avatar');
              }}
              disabled={uploading === 'avatar'}
            />
            {uploading === 'avatar' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fazendo upload...
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Card * (PNG/WebP/JPG - 1920×1080)</Label>
            {formData.card_img && !cardFile && (
              <div className="relative w-48 h-32 rounded-lg overflow-hidden border">
                <img src={formData.card_img} alt="Card atual" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => setFormData({ ...formData, card_img: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {cardFile && (
              <div className="relative w-48 h-32 rounded-lg overflow-hidden border">
                <img src={URL.createObjectURL(cardFile)} alt="Novo card" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => setCardFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, 'card');
              }}
              disabled={uploading === 'card'}
            />
            {uploading === 'card' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fazendo upload...
              </div>
            )}
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
