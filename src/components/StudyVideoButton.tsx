import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonitorPlay, X } from "lucide-react";
import { VideoPlayerModal } from "./VideoPlayerModal";

interface StudyVideoButtonProps {
  videoId: string | null;
  videoTitle?: string | null;
  listTitle?: string | null;
  className?: string;
}

export const StudyVideoButton = ({ 
  videoId, 
  videoTitle, 
  listTitle,
  className = "" 
}: StudyVideoButtonProps) => {
  const [showVideo, setShowVideo] = useState(false);
  const [showNoVideo, setShowNoVideo] = useState(false);

  const hasVideo = videoId && videoId.trim().length > 0;
  const displayTitle = videoTitle || listTitle || "Vídeo da Lição";

  const handleClick = () => {
    if (hasVideo) {
      setShowVideo(true);
    } else {
      setShowNoVideo(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={`gap-2 ${className}`}
      >
        <MonitorPlay className="h-4 w-4" />
        <span className="hidden sm:inline">Vídeo</span>
      </Button>

      {/* Video player modal */}
      {hasVideo && (
        <VideoPlayerModal
          videoId={showVideo ? videoId : null}
          title={displayTitle}
          onClose={() => setShowVideo(false)}
        />
      )}

      {/* No video message overlay */}
      {showNoVideo && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowNoVideo(false)}
          >
            <Card 
              className="relative max-w-sm w-full p-6 text-center animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={() => setShowNoVideo(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <MonitorPlay className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground font-medium">Nenhum vídeo encontrado para esta lista.</p>
            </Card>
          </div>
        </>
      )}
    </>
  );
};
