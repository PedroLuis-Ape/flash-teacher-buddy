import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    if (!FEATURE_FLAGS.admin_skins_enabled) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    setIsAdmin(role?.role === 'developer_admin');
  };

  if (!isAdmin) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/catalog')}
          aria-label="Admin Panel"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Painel de Administração</p>
      </TooltipContent>
    </Tooltip>
  );
}
