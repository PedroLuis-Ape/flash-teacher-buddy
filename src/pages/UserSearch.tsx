import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ArrowLeft, GraduationCap, User as UserIcon, Loader2 } from "lucide-react";
import { searchUsers, type UserSearchResult } from "@/lib/profileEngine";
import { toast } from "sonner";

export default function UserSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [userType, setUserType] = useState<'professor' | 'aluno' | 'todos'>('todos');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      toast.error("Digite pelo menos 2 caracteres para buscar.");
      return;
    }

    setLoading(true);
    setSearched(true);
    
    try {
      const result = await searchUsers(query, userType);
      
      if (result.success && result.users) {
        setResults(result.users);
        if (result.users.length === 0) {
          toast.info("Nenhum usuário encontrado.");
        }
      } else {
        toast.error(result.message || "Erro ao buscar usuários.");
        setResults([]);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Erro ao buscar usuários.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setUserType('todos');
  };

  const getUserTypeLabel = (type: string) => {
    return type === 'professor' ? 'Professor' : 'Aluno';
  };

  const getUserTypeIcon = (type: string) => {
    return type === 'professor' ? GraduationCap : UserIcon;
  };

  const handleVisitProfile = (publicId: string) => {
    navigate(`/perfil/${publicId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Pesquisar" />
      
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar por nome ou ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Ex: João Silva ou P123456"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 h-10"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || query.trim().length < 2}
                size="icon"
                className="h-10 w-10 shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Type Filter */}
            <Tabs value={userType} onValueChange={(v) => setUserType(v as any)}>
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="todos" className="text-xs sm:text-sm">Todos</TabsTrigger>
                <TabsTrigger value="professor" className="text-xs sm:text-sm">Professores</TabsTrigger>
                <TabsTrigger value="aluno" className="text-xs sm:text-sm">Alunos</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Resultados {results.length > 0 && `(${results.length})`}
                </CardTitle>
                {results.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((user) => {
                    const TypeIcon = getUserTypeIcon(user.user_type);
                    const initials = user.name
                      ? user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
                      : "?";

                    return (
                      <div
                        key={user.public_id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{user.name || "Sem nome"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs gap-1 shrink-0">
                              <TypeIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">{getUserTypeLabel(user.user_type)}</span>
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono truncate">
                              {user.public_id}
                            </span>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => handleVisitProfile(user.public_id)}
                          className="h-9 px-3 text-xs shrink-0"
                        >
                          <span className="hidden sm:inline">Visitar </span>Perfil
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="flex-1 h-11"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          {searched && (
            <Button
              onClick={handleClear}
              variant="secondary"
              className="flex-1 h-11"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
