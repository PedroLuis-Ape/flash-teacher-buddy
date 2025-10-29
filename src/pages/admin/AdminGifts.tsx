import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { toast } from "@/hooks/use-toast";
import { sendGift, searchUsers } from "@/lib/giftEngine";
import { Badge } from "@/components/ui/badge";

export default function AdminGifts() {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [skins, setSkins] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedSkin, setSelectedSkin] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, [navigate]);

  const checkAdminAccess = async () => {
    if (!FEATURE_FLAGS.gifting_enabled) {
      navigate('/');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!role || (role.role as string) !== 'developer_admin') {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    loadSkins();
  };

  const loadSkins = async () => {
    const { data } = await supabase
      .from('skins_catalog')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'published')
      .order('name');
    
    setSkins(data || []);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = await searchUsers(searchQuery);
    setSearchResults(results);
  };

  const handleSendGift = async () => {
    if (!selectedUser || !selectedSkin) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um usuário e uma skin.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const result = await sendGift(selectedUser.id, selectedSkin, message);
    setLoading(false);

    if (result.success) {
      toast({
        title: "Presente enviado!",
        description: `Presente enviado para ${selectedUser.first_name || selectedUser.email}.`,
      });
      // Reset form
      setSelectedUser(null);
      setSelectedSkin("");
      setMessage("");
      setSearchQuery("");
      setSearchResults([]);
    } else {
      toast({
        title: "Erro",
        description: result.error || "Não foi possível enviar o presente.",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Verificando permissões...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Enviar Presentes</h1>
        <p className="text-muted-foreground">
          Sistema de gifting para administradores
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Presente</CardTitle>
          <CardDescription>
            Envie skins como presente para usuários específicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Search */}
          <div className="space-y-2">
            <Label>Destinatário</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por tag #PTC-XXXX, email ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {selectedUser && (
              <div className="p-3 border rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedUser.first_name || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    <Badge variant="outline" className="mt-1">
                      {selectedUser.user_tag}
                    </Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            )}

            {searchResults.length > 0 && !selectedUser && (
              <div className="border rounded divide-y max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                  >
                    <p className="font-medium">{user.first_name || 'Sem nome'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <Badge variant="outline" className="mt-1">
                      {user.user_tag}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Skin Selection */}
          <div className="space-y-2">
            <Label>Pacote/Skin</Label>
            <Select value={selectedSkin} onValueChange={setSelectedSkin}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma skin..." />
              </SelectTrigger>
              <SelectContent>
                {skins.map((skin) => (
                  <SelectItem key={skin.id} value={skin.id}>
                    {skin.name} - ₱{skin.price_pitecoin}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea
              placeholder="Escreva uma mensagem para o destinatário..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Send Button */}
          <Button 
            className="w-full" 
            onClick={handleSendGift}
            disabled={loading || !selectedUser || !selectedSkin}
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Enviando..." : "Enviar Presente"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}