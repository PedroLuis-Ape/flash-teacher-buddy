import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Play, ExternalLink, Pencil, Trash2, Plus } from "lucide-react";
import { AddVideoDialog } from "./AddVideoDialog";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Video {
  id: string;
  title: string | null;
  url: string;
  video_id: string;
  thumbnail_url: string;
  order_index: number;
}

interface VideoListProps {
  folderId: string;
  isOwner: boolean;
}

export function VideoList({ folderId, isOwner }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playingVideoTitle, setPlayingVideoTitle] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
    
    // Check URL for video parameter
    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('video');
    if (videoParam) {
      const video = videos.find(v => v.video_id === videoParam);
      if (video) {
        setPlayingVideoId(video.video_id);
        setPlayingVideoTitle(video.title);
      }
    }

    // Handle browser back button
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const videoParam = urlParams.get('video');
      if (!videoParam && playingVideoId) {
        setPlayingVideoId(null);
        setPlayingVideoTitle(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [folderId]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("folder_id", folderId)
        .eq("is_published", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar vídeos:", error);
      toast.error("Erro ao carregar vídeos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;
      toast.success("Vídeo removido com sucesso!");
      loadVideos();
    } catch (error: any) {
      toast.error("Erro ao remover vídeo: " + error.message);
    }
  };

  const handlePlay = (video: Video) => {
    setPlayingVideoId(video.video_id);
    setPlayingVideoTitle(video.title);
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setAddDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando vídeos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOwner && (
        <div className="mb-6">
          <Button onClick={() => setAddDialogOpen(true)} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Adicionar Vídeo
          </Button>
        </div>
      )}

      {videos.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-4 pt-6">
            <div className="text-4xl">📹</div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Nenhum vídeo ainda</h3>
              <p className="text-muted-foreground">
                {isOwner
                  ? "Adicione vídeos do YouTube para seus alunos assistirem"
                  : "Esta pasta ainda não possui vídeos"}
              </p>
            </div>
            {isOwner && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Vídeo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="relative aspect-video bg-muted">
                <img
                  src={video.thumbnail_url}
                  alt={video.title || "Video thumbnail"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => handlePlay(video)}
                    className="rounded-full"
                  >
                    <Play className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
                    className="rounded-full"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                  {video.title || "Vídeo do YouTube"}
                </h3>
                
                {isOwner && (
                  <div className="flex gap-1 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(video)}
                      className="flex-1"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="flex-1">
                          <Trash2 className="h-3 w-3 mr-1 text-destructive" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover vídeo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O vídeo será removido da pasta.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(video.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddVideoDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditingVideo(null);
        }}
        folderId={folderId}
        onVideoAdded={loadVideos}
        editingVideo={editingVideo}
      />

      <VideoPlayerModal
        videoId={playingVideoId}
        title={playingVideoTitle || undefined}
        onClose={() => {
          setPlayingVideoId(null);
          setPlayingVideoTitle(null);
        }}
      />
    </>
  );
}
