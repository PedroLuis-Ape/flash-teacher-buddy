import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseSpecialImportText } from "./lib/parser";

export default function Bridge({ open, onOpenChange }) {
  const [raw, setRaw] = useState("");
  const validate = () => {
    try {
      const parsed = parseSpecialImportText(raw);
      toast.success(`${parsed.items.length} item(ns) reconhecido(s).`);
    } catch (error) {
      toast.error(error?.message || "Resposta inválida.");
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent><DialogHeader><DialogTitle>Importar explicações da IA</DialogTitle></DialogHeader>
      <Textarea value={raw} onChange={(event) => setRaw(event.target.value)} className="min-h-[280px] font-mono text-xs" />
      <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={validate}>Analisar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
