import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [originalUsername, setOriginalUsername] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!username || username.length < 3 || username === originalUsername) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('public_slug')
        .eq('public_slug', cleanUsername)
        .maybeSingle();

      setUsernameAvailable(!data && !error);
      setCheckingUsername(false);
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, originalUsername]);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, public_slug, public_access_enabled")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        setFirstName(profile.first_name || "");
        setUsername(profile.public_slug || "");
        setOriginalUsername(profile.public_slug || "");
        setPublicAccessEnabled(profile.public_access_enabled || false);
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userRole === 'owner' && username && username.length < 3) {
      toast.error("Username deve ter pelo menos 3 caracteres");
      return;
    }

    if (userRole === 'owner' && username && usernameAvailable === false) {
      toast.error("Este username já está em uso");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const cleanUsername = username ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          public_slug: cleanUsername,
          public_access_enabled: publicAccessEnabled,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      setOriginalUsername(cleanUsername || "");
      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <PitecoLogo className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-bold">Configurações de Perfil</h1>
              <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>
              Atualize seus dados de perfil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Seu nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              {userRole === 'owner' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username (seu @)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        id="username"
                        type="text"
                        placeholder="seunome"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-8"
                        minLength={3}
                      />
                    </div>
                    {username && username.length >= 3 && username !== originalUsername && (
                      <p className={`text-sm ${checkingUsername ? 'text-muted-foreground' : usernameAvailable ? 'text-green-600' : 'text-red-600'}`}>
                        {checkingUsername ? 'Verificando...' : usernameAvailable ? '✓ Disponível!' : '✗ Já está em uso'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Apenas letras, números e _ (mínimo 3 caracteres)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="publicAccess">Aparecer na Busca Pública</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite que alunos encontrem você e suas pastas compartilhadas
                        </p>
                      </div>
                      <Switch
                        id="publicAccess"
                        checked={publicAccessEnabled}
                        onCheckedChange={setPublicAccessEnabled}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
