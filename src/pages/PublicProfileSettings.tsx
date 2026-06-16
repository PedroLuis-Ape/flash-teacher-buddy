import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  GraduationCap,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { ApeAppBar } from '@/components/ape/ApeAppBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface TeacherSettings {
  success: boolean;
  error?: string;
  first_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  public_bio: string | null;
  public_specialties: string[];
  public_access_enabled: boolean;
  public_profile_searchable: boolean;
  previewMode?: boolean;
}

interface TeacherFolder {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  list_count: number | string;
  card_count: number | string;
}

function isMissingSettingsRpc(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`.toLowerCase();
  return value?.code === 'PGRST202' || value?.code === '42883' || text.includes('public_teacher');
}

function normalizeSpecialties(value: string) {
  const unique = new Map<string, string>();
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLocaleLowerCase('pt-BR');
      if (!unique.has(key)) unique.set(key, item);
    });
  return Array.from(unique.values());
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P';
}

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

const ERROR_MESSAGES: Record<string, string> = {
  TEACHER_REQUIRED: 'Esta configuração está disponível apenas para contas de professor.',
  PUBLIC_SLUG_REQUIRED: 'Defina um username público antes de ativar o perfil.',
  BIO_TOO_LONG: 'A bio deve ter no máximo 500 caracteres.',
  TOO_MANY_SPECIALTIES: 'Use no máximo 8 especialidades.',
  SPECIALTY_TOO_LONG: 'Cada especialidade deve ter no máximo 40 caracteres.',
  FOLDER_NOT_FOUND: 'A pasta não foi encontrada ou não pertence a esta conta.',
};

export default function PublicProfileSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuthUser();
  const [bio, setBio] = useState('');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [searchable, setSearchable] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, navigate, user]);

  const settingsQuery = useQuery({
    queryKey: ['own-public-teacher-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_own_public_teacher_settings');

      if (error && isMissingSettingsRpc(error)) {
        const { data: fallbackProfile, error: fallbackError } = await (supabase.from('profiles') as any)
          .select('first_name, avatar_url, public_slug, public_access_enabled, is_teacher')
          .eq('id', user?.id)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        if (!fallbackProfile?.is_teacher) {
          return {
            success: false,
            error: 'TEACHER_REQUIRED',
          } as TeacherSettings;
        }

        return {
          success: true,
          first_name: fallbackProfile.first_name,
          avatar_url: fallbackProfile.avatar_url,
          public_slug: fallbackProfile.public_slug,
          public_bio: '',
          public_specialties: [],
          public_access_enabled: Boolean(fallbackProfile.public_access_enabled),
          public_profile_searchable: false,
          previewMode: true,
        } as TeacherSettings;
      }

      if (error) throw error;
      return data as TeacherSettings;
    },
    enabled: Boolean(user),
    retry: false,
    staleTime: 30_000,
  });

  const foldersQuery = useQuery({
    queryKey: ['own-public-teacher-folders', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_own_public_teacher_folders');

      if (error && isMissingSettingsRpc(error)) {
        const { data: fallbackFolders, error: fallbackError } = await (supabase.from('folders') as any)
          .select('id, title, description, visibility')
          .eq('owner_id', user?.id)
          .is('class_id', null)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        return (fallbackFolders ?? []).map((folder: any) => ({
          id: folder.id,
          title: folder.title,
          description: folder.description,
          is_public: folder.visibility === 'class',
          list_count: 0,
          card_count: 0,
        })) as TeacherFolder[];
      }

      if (error) throw error;
      return (data ?? []) as TeacherFolder[];
    },
    enabled: Boolean(user && settingsQuery.data?.success),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings?.success) return;
    setBio(settings.public_bio ?? '');
    setSpecialtiesText((settings.public_specialties ?? []).join(', '));
    setPublicEnabled(Boolean(settings.public_access_enabled));
    setSearchable(Boolean(settings.public_profile_searchable));
  }, [settingsQuery.data]);

  const specialties = useMemo(() => normalizeSpecialties(specialtiesText), [specialtiesText]);
  const settings = settingsQuery.data;
  const displayName = settings?.first_name?.trim()
    ? settings.first_name.toLocaleLowerCase('pt-BR').startsWith('professor ')
      ? settings.first_name
      : `Professor ${settings.first_name}`
    : 'Professor';
  const profileUrl = settings?.public_slug
    ? `${window.location.origin}/portal/professor/${settings.public_slug}`
    : '';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.previewMode) throw new Error('PREVIEW_DATABASE_PENDING');
      if (bio.trim().length > 500) throw new Error('BIO_TOO_LONG');
      if (specialties.length > 8) throw new Error('TOO_MANY_SPECIALTIES');
      if (specialties.some((item) => item.length > 40)) throw new Error('SPECIALTY_TOO_LONG');

      const { data, error } = await (supabase.rpc as any)('update_public_teacher_settings', {
        _public_bio: bio,
        _public_specialties: specialties,
        _public_access_enabled: publicEnabled,
        _public_profile_searchable: publicEnabled && searchable,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'UNKNOWN_ERROR');
      return data;
    },
    onSuccess: async () => {
      toast.success('Perfil público atualizado!');
      await queryClient.invalidateQueries({ queryKey: ['own-public-teacher-settings', user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['public-teacher-directory'] });
      await queryClient.invalidateQueries({ queryKey: ['public-teacher-profile'] });
    },
    onError: (error: any) => {
      if (error?.message === 'PREVIEW_DATABASE_PENDING') {
        toast.info('A interface está pronta, mas a migration ainda não foi aplicada no banco do preview.');
        return;
      }
      toast.error(ERROR_MESSAGES[error?.message] || error?.message || 'Não foi possível salvar.');
    },
  });

  const folderMutation = useMutation({
    mutationFn: async ({ folderId, isPublic }: { folderId: string; isPublic: boolean }) => {
      if (settings?.previewMode) throw new Error('PREVIEW_DATABASE_PENDING');
      const { data, error } = await (supabase.rpc as any)('set_public_teacher_folder_visibility', {
        _folder_id: folderId,
        _is_public: isPublic,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'UNKNOWN_ERROR');
      return { folderId, isPublic };
    },
    onSuccess: async ({ isPublic }) => {
      toast.success(isPublic ? 'Pasta publicada no perfil!' : 'Pasta removida do perfil público.');
      await queryClient.invalidateQueries({ queryKey: ['own-public-teacher-folders', user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['public-teacher-profile'] });
    },
    onError: (error: any) => {
      if (error?.message === 'PREVIEW_DATABASE_PENDING') {
        toast.info('A publicação real das pastas depende da migration desta etapa.');
        return;
      }
      toast.error(ERROR_MESSAGES[error?.message] || error?.message || 'Não foi possível atualizar a pasta.');
    },
  });

  const copyProfileLink = async () => {
    if (!profileUrl) return;
    await navigator.clipboard.writeText(profileUrl);
    toast.success('Link do perfil copiado!');
  };

  if (authLoading || settingsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <ApeAppBar title="Perfil público" showBack backPath="/painel-professor" />
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando configurações...
        </div>
      </div>
    );
  }

  if (settingsQuery.isError || !settings?.success) {
    return (
      <div className="min-h-screen bg-background">
        <ApeAppBar title="Perfil público" showBack backPath="/painel-professor" />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <Card className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">Configuração indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {ERROR_MESSAGES[settings?.error ?? ''] || 'Não foi possível carregar as configurações do perfil público.'}
            </p>
            <Button className="mt-6" onClick={() => navigate('/painel-professor')}>
              Voltar ao painel
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <ApeAppBar title="Perfil público" showBack backPath="/painel-professor" />

      <main className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          {settings.previewMode && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
              A interface pode ser testada, mas o banco do preview ainda não possui a migration desta etapa. Salvar e publicar pastas ficam disponíveis após a implantação.
            </Card>
          )}

          <Card className="space-y-6 p-5 sm:p-6">
            <div>
              <h1 className="text-xl font-bold">Informações públicas</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Estes dados aparecem somente no seu perfil público de professor.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="public-bio">Bio pública</Label>
                <span className="text-xs text-muted-foreground">{bio.length}/500</span>
              </div>
              <Textarea
                id="public-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 500))}
                placeholder="Explique como você ensina, para quais alunos e quais materiais costuma publicar."
                className="min-h-32 resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="public-specialties">Especialidades</Label>
              <Input
                id="public-specialties"
                value={specialtiesText}
                onChange={(event) => setSpecialtiesText(event.target.value)}
                placeholder="Conversação, iniciantes, gramática..."
              />
              <p className="text-xs text-muted-foreground">
                Separe por vírgulas. Máximo de 8 especialidades, com até 40 caracteres cada.
              </p>
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {specialties.slice(0, 8).map((specialty) => (
                    <Badge key={specialty} variant="outline" className="font-normal">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="public-enabled" className="text-base">Perfil público ativo</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Permite abrir seu perfil pelo link público. Desativar não apaga seus materiais.
                </p>
              </div>
              <Switch
                id="public-enabled"
                checked={publicEnabled}
                onCheckedChange={(checked) => {
                  setPublicEnabled(checked);
                  if (!checked) setSearchable(false);
                }}
                disabled={!settings.public_slug}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="public-searchable" className="text-base">Aparecer na pesquisa</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quando desligado, o perfil continua acessível pelo link, mas não aparece no diretório.
                </p>
              </div>
              <Switch
                id="public-searchable"
                checked={publicEnabled && searchable}
                onCheckedChange={setSearchable}
                disabled={!publicEnabled}
              />
            </div>

            {!settings.public_slug && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Esta conta ainda não possui username público. Defina um username antes de ativar o perfil.
              </p>
            )}

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || specialties.length > 8 || bio.length > 500}
              className="w-full sm:w-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Salvar perfil público
            </Button>
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Materiais publicados</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha quais pastas pessoais aparecem dentro do seu perfil público.
                </p>
              </div>
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>

            {foldersQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando pastas...</div>
            ) : foldersQuery.isError ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Não foi possível carregar suas pastas.</p>
                <Button variant="outline" className="mt-4" onClick={() => foldersQuery.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (foldersQuery.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Nenhuma pasta pessoal encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">Crie uma pasta antes de publicar materiais.</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/folders')}>
                  Ir para minhas pastas
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-xl border">
                {(foldersQuery.data ?? []).map((folder) => {
                  const pending = folderMutation.isPending && folderMutation.variables?.folderId === folder.id;
                  return (
                    <div key={folder.id} className="flex items-center gap-4 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{folder.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {asNumber(folder.list_count)} listas • {asNumber(folder.card_count)} cards
                        </p>
                      </div>
                      {pending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={folder.is_public}
                          onCheckedChange={(checked) =>
                            folderMutation.mutate({ folderId: folder.id, isPublic: checked })
                          }
                          aria-label={`${folder.is_public ? 'Remover' : 'Publicar'} ${folder.title}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-primary/25 via-primary-glow/15 to-transparent" />
            <div className="p-5">
              <div className="-mt-12 flex items-end gap-3">
                <Avatar className="h-20 w-20 border-4 border-card shadow-md">
                  <AvatarImage src={settings.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-lg font-bold">{initials(displayName)}</AvatarFallback>
                </Avatar>
                <Badge variant="secondary" className="mb-1 gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Prévia
                </Badge>
              </div>

              <h2 className="mt-4 text-xl font-bold">{displayName}</h2>
              {settings.public_slug && (
                <p className="text-sm text-muted-foreground">@{settings.public_slug}</p>
              )}
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {bio.trim() || 'Sua bio pública aparecerá aqui.'}
              </p>

              {specialties.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {specialties.slice(0, 8).map((specialty) => (
                    <Badge key={specialty} variant="outline" className="text-xs font-normal">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-5 space-y-2 rounded-xl border bg-background/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {publicEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    Perfil
                  </span>
                  <span className="font-medium">{publicEnabled ? 'Público' : 'Oculto'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Search className="h-4 w-4" />
                    Pesquisa
                  </span>
                  <span className="font-medium">{publicEnabled && searchable ? 'Visível' : 'Oculto'}</span>
                </div>
              </div>
            </div>
          </Card>

          {profileUrl && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium">Link público</p>
              <p className="break-all rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {profileUrl}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={copyProfileLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(profileUrl, '_blank', 'noopener,noreferrer')}
                  disabled={!publicEnabled}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </Button>
              </div>
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
}
