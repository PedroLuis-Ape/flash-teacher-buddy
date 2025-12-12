import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Plus } from 'lucide-react';
import { DMPanel } from './DMPanel';
import { cn } from '@/lib/utils';

interface DMListProps {
  turmaId: string;
  isOwner: boolean;
  membros: Array<{
    user_id: string;
    role: string;
    profiles?: {
      id: string;
      first_name: string;
      ape_id: string;
    };
  }>;
  teacherId?: string;
  teacherName?: string;
}

export function DMList({ turmaId, isOwner, membros, teacherId, teacherName }: DMListProps) {
  const [selectedRecipient, setSelectedRecipient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-dm'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // For teachers: show list of students to message
  // For students: show option to message teacher
  const recipients = isOwner
    ? membros
        .filter((m) => m.role === 'aluno')
        .map((m) => ({
          id: m.user_id,
          name: m.profiles?.first_name || 'Aluno',
        }))
    : teacherId && teacherName
    ? [{ id: teacherId, name: teacherName }]
    : [];

  if (selectedRecipient && currentUser) {
    return (
      <DMPanel
        turmaId={turmaId}
        recipientId={selectedRecipient.id}
        recipientName={selectedRecipient.name}
        currentUserId={currentUser.id}
        isTeacher={isOwner}
        onBack={() => setSelectedRecipient(null)}
      />
    );
  }

  if (recipients.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nenhuma conversa</h3>
        <p className="text-muted-foreground">
          {isOwner
            ? 'Adicione alunos à turma para iniciar conversas.'
            : 'Nenhum professor disponível para conversa.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isOwner ? 'Mensagens com Alunos' : 'Mensagem com Professor'}
        </h3>
        <Badge variant="secondary">{recipients.length}</Badge>
      </div>

      <ScrollArea className="h-[450px]">
        <div className="space-y-2 pr-4">
          {recipients.map((recipient) => (
            <Card
              key={recipient.id}
              className={cn(
                'p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
                'flex items-center gap-4'
              )}
              onClick={() => setSelectedRecipient(recipient)}
            >
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {isOwner ? recipient.name : `Professor @${recipient.name}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOwner ? 'Aluno' : 'Clique para conversar'}
                </p>
              </div>
              <Button variant="ghost" size="icon">
                <MessageSquare className="h-5 w-5 text-primary" />
              </Button>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
