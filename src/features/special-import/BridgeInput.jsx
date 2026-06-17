import { useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function BridgeInput({ state }) {
  const fileRef = useRef(null);
  return <>
    <input ref={fileRef} type="file" accept=".json,.txt" className="hidden" onChange={(event) => { state.loadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <Button variant="outline" onClick={() => fileRef.current?.click()} className="self-start"><FileUp className="h-4 w-4 mr-1" />Carregar JSON/TXT</Button>
    <Textarea value={state.raw} onChange={(event) => state.setRaw(event.target.value)} className="min-h-[280px] font-mono text-xs" placeholder='{"format":"ape-special-explanations","items":[...]}' />
    <Button onClick={state.validate} disabled={state.busy || !state.raw.trim()} className="self-end">{state.busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Analisar e conferir</Button>
  </>;
}
