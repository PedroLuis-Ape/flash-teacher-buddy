import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, PackageOpen, Sparkles, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SkinPackageDialog } from "@/features/store/components/SkinPackageDialog";
import {
  equipAvatarAsPhoto,
  equipSkin,
  getEquippedSkins,
  getRarityColor,
  getRarityLabel,
  getUserInventory,
  type InventoryItem,
  type SkinItem,
} from "@/lib/storeEngine";

interface Item extends InventoryItem {
  name: string;
  rarity: SkinItem["rarity"];
  card: string;
  avatar: string;
  price: number;
  description: string | null;
}

const asSkin = (item: Item): SkinItem => ({
  id: item.skin_id,
  name: item.name,
  rarity: item.rarity,
  price_pitecoin: item.price,
  avatar_final: item.avatar,
  card_final: item.card,
  description: item.description,
  is_active: true,
});

export function InventoryTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [mascotId, setMascotId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const [inventory, equipped] = await Promise.all([
        getUserInventory(session.user.id),
        getEquippedSkins(session.user.id),
      ]);
      setItems(inventory.map(item => ({
        ...item,
        name: item.skin?.name || "Desconhecido",
        rarity: item.skin?.rarity || "normal",
        card: item.skin?.card_final || "",
        avatar: item.skin?.avatar_final || "",
        price: item.skin?.price_pitecoin || 0,
        description: item.skin?.description || null,
      })));
      setAvatarId(equipped.avatar_skin_id);
      setMascotId(equipped.mascot_skin_id);
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast.error("Erro ao carregar inventário");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const equip = async (item: Item, type: "avatar" | "mascot") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const key = `${item.skin_id}:${type}`;
    setBusy(key);
    try {
      const result = await equipSkin(session.user.id, item.skin_id, type, crypto.randomUUID());
      if (!result.success) {
        toast.error(result.message || "Erro ao equipar");
        return;
      }
      if (type === "avatar") setAvatarId(item.skin_id);
      else setMascotId(item.skin_id);
      toast.success(result.message || "Visual equipado!");
    } catch (error) {
      console.error("Error equipping:", error);
      toast.error("Erro ao equipar item");
    } finally {
      setBusy(null);
    }
  };

  const setPhoto = async (item: Item) => {
    if (!item.avatar) {
      toast.error("Avatar sem imagem válida");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setBusy(`${item.skin_id}:photo`);
    try {
      const result = await equipAvatarAsPhoto(session.user.id, item.skin_id, item.avatar);
      result.success ? toast.success(result.message) : toast.error(result.message);
    } catch (error) {
      console.error("Error setting photo:", error);
      toast.error("Erro ao definir foto de perfil");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card><CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent></Card>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="rounded-2xl"><CardContent className="py-10 text-center">
          <PackageOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="font-semibold">Inventário vazio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Visite a aba Pacotes para começar sua coleção.</p>
        </CardContent></Card>
      </div>
    );
  }

  const avatar = items.find(item => item.skin_id === avatarId);
  const mascot = items.find(item => item.skin_id === mascotId);
  const selectedAvatar = selected?.skin_id === avatarId;
  const selectedMascot = selected?.skin_id === mascotId;

  return (
    <div className="container mx-auto space-y-5 px-4 py-5">
      <section>
        <h2 className="mb-3 text-lg font-bold">Equipados agora</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Avatar", item: avatar, image: avatar?.avatar || avatar?.card, Icon: UserRound },
            { label: "Mascote", item: mascot, image: mascot?.card, Icon: Sparkles },
          ].map(({ label, item, image, Icon }) => (
            <Card key={label} className="rounded-2xl">
              <CardContent className="flex min-h-24 items-center gap-3 p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                  {image ? <img src={image} alt={item?.name || label} className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="line-clamp-2 text-sm font-semibold">{item?.name || "Nenhum"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Seus pacotes</h2>
        <p className="mb-3 text-sm text-muted-foreground">Toque em um pacote para visualizar e equipar.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const isAvatar = item.skin_id === avatarId;
            const isMascot = item.skin_id === mascotId;
            return (
              <Card
                key={item.id}
                role="button"
                tabIndex={0}
                className="group cursor-pointer overflow-hidden rounded-2xl hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSelected(item)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(item);
                  }
                }}
              >
                <div className="flex min-h-36 sm:block">
                  <div className="relative aspect-[3/4] w-28 shrink-0 bg-gradient-to-br from-primary/10 to-secondary/10 sm:w-full">
                    {item.card && <img src={item.card} alt={item.name} className="h-full w-full object-contain p-1.5" />}
                    <Badge variant="outline" className={`absolute bottom-2 left-2 text-[10px] ${getRarityColor(item.rarity)}`}>
                      {getRarityLabel(item.rarity)}
                    </Badge>
                  </div>
                  <CardContent className="flex min-w-0 flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 font-semibold">{item.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description || "Pacote visual do App Piteco."}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      {isAvatar && <Badge className="gap-1 text-[10px]"><Check className="h-3 w-3" />Avatar ativo</Badge>}
                      {isMascot && <Badge className="gap-1 text-[10px]"><Check className="h-3 w-3" />Mascote ativo</Badge>}
                      {!isAvatar && !isMascot && <span className="text-xs font-medium text-primary">Toque para gerenciar</span>}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {selected && (
        <SkinPackageDialog
          skin={asSkin(selected)}
          open
          onOpenChange={open => { if (!open) setSelected(null); }}
          owned
          actions={
            <>
              {selected.avatar && (
                <Button variant="outline" className="h-12 w-full gap-2 sm:w-auto" onClick={() => setPhoto(selected)} disabled={busy === `${selected.skin_id}:photo`}>
                  {busy === `${selected.skin_id}:photo` ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                  Usar como foto
                </Button>
              )}
              <Button variant="outline" className="h-12 w-full gap-2 sm:w-auto" onClick={() => equip(selected, "avatar")} disabled={selectedAvatar || busy === `${selected.skin_id}:avatar`}>
                {busy === `${selected.skin_id}:avatar` ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedAvatar ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                {selectedAvatar ? "Avatar equipado" : "Equipar avatar"}
              </Button>
              <Button className="h-12 w-full gap-2 sm:w-auto" onClick={() => equip(selected, "mascot")} disabled={selectedMascot || busy === `${selected.skin_id}:mascot`}>
                {busy === `${selected.skin_id}:mascot` ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedMascot ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {selectedMascot ? "Mascote equipado" : "Equipar mascote"}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
