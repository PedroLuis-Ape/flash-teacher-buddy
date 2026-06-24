import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  folderId: string;
  folderTitle?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function FolderGlossarySyncDialog({
  folderId,
  folderTitle,
  label = "Glossário da pasta",
  compact = false,
  className,
  stopPropagation = false,
  variant = "outline",
}: Props) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? "icon" : "sm"}
      className={className}
      title={folderTitle ? `Abrir glossário de ${folderTitle}` : label}
      aria-label={folderTitle ? `Abrir glossário de ${folderTitle}` : label}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        navigate(`/glossary?folder=${folderId}`);
      }}
    >
      <BookOpen className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
      {!compact && label}
    </Button>
  );
}
