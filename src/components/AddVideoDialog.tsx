import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseYouTubeUrl, isYouTubeUrl } from "@/lib/youtubeParser";
import { supabase } from "@/integrations/supabase/client";
import { Youtube } from "lucide-react";

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  onVideoAdded: () => void;
  editingVideo?: {
    id: string;
    title: string | null;
    url: string;
  } | null;
}

export function AddVideoDialog({ 
  open, 
  onOpenChange, 
  folderId, 
  onVideoAdded,
  editingVideo 
}: AddVideoDialogProps) {
  const [url, setUrl] = useState(editingVideo?.url || "");
  const [title, setTitle] = useState(editingVideo?.title || "");
  const [bulkUrls, setBulkUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setBulkUrls("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const urlsToProcess = bulkUrls.trim() 
      ? bulkUrls.split('\n').filter(u => u.trim())
      : [url.trim()];

    if (urlsToProcess.length === 0 || !urlsToProcess[0]) {
      toast.error("Insira pelo menos um URL do YouTube");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Faça login para adicionar vídeos");

      // Get current max order_index
      const { data: existingVideos } = await supabase
        .from("videos")
        .select("order_index")
        .eq("folder_id", folderId)
        .order("order_index", { ascending: false })
        .limit(1);

      let nextOrderIndex = existingVideos?.[0]?.order_index ?? -1;

      if (editingVideo) {
        // Update existing video
        const parsed = parseYouTubeUrl(url.trim());
        if (!parsed) {
          toast.error("URL do YouTube inválido");
          return;
        }

        const { error } = await supabase
          .from("videos")
          .update({
            title: title.trim() || null,
            url: url.trim(),
            video_id: parsed.videoId,
            thumbnail_url: parsed.thumbnailUrl,
          })
          .eq("id", editingVideo.id);

        if (error) throw error;
        toast.success("Vídeo atualizado com sucesso!");
      } else {
        // Create new video(s)
        const videosToInsert = [];

        for (const videoUrl of urlsToProcess) {
          if (!isYouTubeUrl(videoUrl)) {
            toast.error(`URL inválido (não é YouTube): ${videoUrl.substring(0, 50)}`);
            continue;
          }

          const parsed = parseYouTubeUrl(videoUrl);
          if (!parsed) {
            toast.error(`Não foi possível extrair ID do vídeo: ${videoUrl.substring(0, 50)}`);
            continue;
          }

          nextOrderIndex++;
          videosToInsert.push({
            folder_id: folderId,
            title: urlsToProcess.length === 1 ? (title.trim() || null) : null,
            url: videoUrl,
            provider: "youtube",
            video_id: parsed.videoId,
            thumbnail_url: parsed.thumbnailUrl,
            order_index: nextOrderIndex,
            created_by: session.user.id,
          });
        }

        if (videosToInsert.length === 0) {
          toast.error("Nenhum vídeo válido para adicionar");
          return;
        }

        const { error } = await supabase
          .from("videos")
          .insert(videosToInsert);

        if (error) throw error;
        
        toast.success(
          videosToInsert.length === 1 
            ? "Vídeo adicionado com sucesso!" 
            : `${videosToInsert.length} vídeos adicionados com sucesso!`
        );
      }

      resetForm();
      onOpenChange(false);
      onVideoAdded();
    } catch (error: any) {
      console.error("Erro ao salvar vídeo:", error);
      toast.error("Erro ao salvar vídeo: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" />
            {editingVideo ? "Editar Vídeo" : "Adicionar Vídeo do YouTube"}
          </DialogTitle>
          <DialogDescription>
            {editingVideo 
              ? "Atualize as informações do vídeo" 
              : "Cole um ou mais URLs do YouTube (um por linha para múltiplos)"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {editingVideo ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">URL do YouTube *</Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título (opcional)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Deixe em branco para usar o título original"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="single-url">URL Único</Label>
                  <Input
                    id="single-url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setBulkUrls("");
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={!!bulkUrls}
                  />
                </div>
                
                {url && (
                  <div className="space-y-2">
                    <Label htmlFor="title">Título (opcional)</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Deixe em branco para usar o título original"
                    />
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      ou adicionar múltiplos
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">Múltiplos URLs (um por linha)</Label>
                  <Textarea
                    id="bulk-urls"
                    value={bulkUrls}
                    onChange={(e) => {
                      setBulkUrls(e.target.value);
                      setUrl("");
                      setTitle("");
                    }}
                    placeholder="https://www.youtube.com/watch?v=abc123&#10;https://youtu.be/xyz789&#10;https://www.youtube.com/shorts/def456"
                    rows={5}
                    disabled={!!url}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: youtube.com/watch, youtu.be, youtube.com/shorts
                  </p>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : editingVideo ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
