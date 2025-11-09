import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Folder, FileText, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApeCardProfessorProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  folderCount?: number;
  listCount?: number;
  cardCount?: number;
  onClick?: () => void;
  className?: string;
}

export function ApeCardProfessor({
  name,
  email,
  avatarUrl,
  folderCount,
  listCount,
  cardCount,
  onClick,
  className
}: ApeCardProfessorProps) {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-4 rounded-xl",
        "bg-card hover:bg-accent transition-colors",
        "border border-border",
        "text-left",
        className
      )}
    >
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">
          {name}
        </h3>
        {email && (
          <p className="text-xs text-muted-foreground truncate">
            {email}
          </p>
        )}
        
        {(folderCount !== undefined || listCount !== undefined || cardCount !== undefined) && (
          <div className="flex items-center gap-3 mt-1">
            {folderCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Folder className="h-3 w-3" />
                {folderCount}
              </span>
            )}
            {listCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {listCount}
              </span>
            )}
            {cardCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                {cardCount}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
