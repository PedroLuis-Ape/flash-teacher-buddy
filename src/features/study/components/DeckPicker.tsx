import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles } from "lucide-react";
import { type InventoryItem, getRarityColor, getRarityLabel } from "@/lib/storeEngine";
import { cn } from "@/lib/utils";

interface DeckPickerProps {
  open: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  mode: "avatar" | "mascote";
  onSelect: (skinId: string) => Promise<void>;
  equipping: boolean;
}

export function DeckPicker({ open, onClose, inventory, mode, onSelect, equipping }: DeckPickerProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"avatares" | "mascotes" | "bundles">(
    mode === "avatar" ? "avatares" : "mascotes"
  );

  const handleSelect = async () => {
    if (!selectedItem) return;
    try {
      await onSelect(selectedItem.skin_id);
      // Only close and reset after success
      setSelectedItem(null);
    } catch (error) {
      // Keep modal open on error so user can retry
      console.error('[DeckPicker] Error selecting item:', error);
    }
  };

  const handleClose = () => {
    setSelectedItem(null);
    onClose();
  };

  // Filter items by tab
  const getFilteredItems = () => {
    return inventory.filter((item) => {
      const skin = item.skin;
      if (!skin) return false;
      if (activeTab === 'avatares') return !!skin.avatar_final;
      if (activeTab === 'mascotes') return !!skin.card_final;
      return true;
    });
  };

  const filteredItems = getFilteredItems();

  // Preview mode
  if (selectedItem?.skin) {
    const isAvatarMode = mode === "avatar";
    const previewUrl = isAvatarMode ? selectedItem.skin.avatar_final : selectedItem.skin.card_final;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pré-visualização</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedItem(null)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Large preview */}
            <div className="flex justify-center p-6 bg-muted/30 rounded-lg">
              <img
                src={previewUrl}
                alt={selectedItem.skin.name}
                className={cn(
                  "max-w-full h-auto",
                  isAvatarMode ? "w-48 h-48 rounded-full object-cover" : "w-48 rounded-xl"
                )}
              />
            </div>

            {/* Details */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{selectedItem.skin.name}</h3>
              <Badge className={cn("text-xs border", getRarityColor(selectedItem.skin.rarity))}>
                <Sparkles className="h-3 w-3 mr-1" />
                {getRarityLabel(selectedItem.skin.rarity)}
              </Badge>
              {selectedItem.skin.description && (
                <p className="text-sm text-muted-foreground">{selectedItem.skin.description}</p>
              )}
            </div>

            {/* Action button */}
            <Button
              onClick={handleSelect}
              disabled={equipping}
              className="w-full min-h-[44px]"
            >
              {equipping ? "Ativando..." : `Ativar ${isAvatarMode ? "Avatar" : "Mascote"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Grid mode
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "avatar" ? "Selecionar Avatar" : "Selecionar Mascote"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="avatares">Avatares</TabsTrigger>
            <TabsTrigger value="mascotes">Mascotes</TabsTrigger>
          </TabsList>

          <TabsContent value="avatares" className="mt-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  Você ainda não possui avatares
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="p-3 rounded-xl border bg-card hover:bg-accent transition-colors text-left group"
                  >
                    <div className="aspect-square rounded-full overflow-hidden mb-2 bg-muted">
                      <img
                        src={item.skin!.avatar_final}
                        alt={item.skin!.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-sm font-medium truncate">{item.skin!.name}</p>
                    <Badge className={cn("text-xs border mt-1", getRarityColor(item.skin!.rarity))}>
                      {getRarityLabel(item.skin!.rarity)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mascotes" className="mt-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  Você ainda não possui mascotes
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="p-3 rounded-xl border bg-card hover:bg-accent transition-colors text-left group"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden mb-2 bg-muted">
                      <img
                        src={item.skin!.card_final}
                        alt={item.skin!.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-sm font-medium truncate">{item.skin!.name}</p>
                    <Badge className={cn("text-xs border mt-1", getRarityColor(item.skin!.rarity))}>
                      {getRarityLabel(item.skin!.rarity)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
