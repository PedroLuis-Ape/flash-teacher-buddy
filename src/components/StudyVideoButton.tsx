import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonitorPlay } from "lucide-react";
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

  // Don't render if no video
  if (!videoId) return null;

  const displayTitle = videoTitle || listTitle || "Vídeo da Lição";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowVideo(true)}
        className={`gap-2 ${className}`}
      >
        <MonitorPlay className="h-4 w-4" />
        <span className="hidden sm:inline">Vídeo</span>
      </Button>

      <VideoPlayerModal
        videoId={showVideo ? videoId : null}
        title={displayTitle}
        onClose={() => setShowVideo(false)}
      />
    </>
  );
};
