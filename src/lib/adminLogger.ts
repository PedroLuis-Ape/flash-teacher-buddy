import { supabase } from "@/integrations/supabase/client";

export async function logAdminAction(
  action: string,
  target: string,
  details?: Record<string, any>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('admin_logs').insert({
      actor_id: session.user.id,
      action,
      target,
      details: details || null,
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}
