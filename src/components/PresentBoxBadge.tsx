import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPendingGiftCount } from "@/lib/giftEngine";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function PresentBoxBadge() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadCount();

    // Subscribe to realtime gift updates
    const channel = supabase
      .channel('gift_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gift_offers',
        },
        () => {
          loadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCount = async () => {
    const newCount = await getPendingGiftCount();
    setCount(newCount);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => navigate('/gifts')}
    >
      <Gift className="h-5 w-5" />
      {count > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {count}
        </Badge>
      )}
    </Button>
  );
}