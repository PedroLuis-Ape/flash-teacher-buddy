import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Plus } from 'lucide-react';

interface CreateAnnouncementDialogProps {
  onSubmit: (title: string, body: string, pinned: boolean) => Promise<void>;
}

export function CreateAnnouncementDialog({ onSubmit }: CreateAnnouncementDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(title.trim(), body.trim(), pinned);
      setOpen(false);
      setTitle('');
      setBody('');
      setPinned(false);
    } catch (error) {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo anúncio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar anúncio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do anúncio"
              maxLength={200}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {title.length}/200 caracteres
            </p>
          </div>

          <div>
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Digite a mensagem do anúncio"
              rows={6}
              maxLength={5000}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {body.length}/5000 caracteres
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="pinned" className="cursor-pointer">
              Fixar no topo
            </Label>
            <Switch
              id="pinned"
              checked={pinned}
              onCheckedChange={setPinned}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
              {submitting ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
