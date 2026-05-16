import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, BookOpen } from "lucide-react";

interface PublicBackBarProps {
  showPortal?: boolean;
}

/**
 * Lightweight back/home bar for public pages so visitors never
 * get trapped. Uses history when available, falls back to "/".
 */
export function PublicBackBar({ showPortal = true }: PublicBackBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  const onPortal = location.pathname.startsWith("/portal");

  return (
    <div className="max-w-6xl mx-auto w-full px-4 md:px-6 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/">
            <Home className="h-4 w-4" />
            Início
          </Link>
        </Button>
        {showPortal && !onPortal && (
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/portal">
              <BookOpen className="h-4 w-4" />
              Portal
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}