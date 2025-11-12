import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ChatComposerProps {
  onSend: (texto: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!texto.trim() || sending) return;

    if (texto.length > 2000) {
      toast.error('Mensagem muito longa (máx 2000 caracteres)');
      return;
    }

    setSending(true);
    try {
      await onSend(texto.trim());
      setTexto('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para quebrar linha)"
        disabled={disabled || sending}
        className="min-h-[60px] max-h-[120px]"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || sending || !texto.trim()}
        size="icon"
        className="shrink-0 h-[60px] w-[60px]"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}