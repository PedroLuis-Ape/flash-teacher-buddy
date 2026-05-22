import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SmartCTA } from "./SmartCTA";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";

/**
 * Sticky CTA mobile — aparece somente em telas pequenas, após o usuário
 * rolar ~30% da viewport. Não aparece no app interno (é montado apenas
 * dentro da LandingPage).
 */
export function LandingStickyCTA() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthUser();

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.max(240, window.innerHeight * 0.3);
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={[
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-border bg-background/95 backdrop-blur",
        "px-4 pt-3",
        "pb-[calc(env(safe-area-inset-bottom,0px)+12px)]",
        "transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 max-w-md mx-auto">
        <SmartCTA
          destination="app"
          placement="sticky"
          size="default"
          className="flex-1 !w-auto gap-2"
          label={
            <>
              Começar a estudar <ArrowRight className="h-4 w-4" />
            </>
          }
          authedLabel={
            <>
              Abrir meu painel <ArrowRight className="h-4 w-4" />
            </>
          }
        />
        {!user && (
          <Button
            variant="ghost"
            size="default"
            onClick={() => navigate("/portal")}
            className="shrink-0 !w-auto"
          >
            Ver atividade
          </Button>
        )}
      </div>
    </div>
  );
}

export default LandingStickyCTA;