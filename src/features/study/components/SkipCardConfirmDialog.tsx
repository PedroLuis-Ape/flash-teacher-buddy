import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { skipDialogCopyFor, type StudyFlowMode } from "@/features/study/lib/advanceGate";

export interface SkipCardConfirmDialogProps {
  open: boolean;
  flowMode: StudyFlowMode;
  onCancel: () => void;
  onKnown: () => void;
  onUnknown: () => void;
}

export function SkipCardConfirmDialog({
  open,
  flowMode,
  onCancel,
  onKnown,
  onUnknown,
}: SkipCardConfirmDialogProps) {
  const copy = skipDialogCopyFor(flowMode);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      confirmingRef.current = false;
      return;
    }
    window.setTimeout(() => cancelRef.current?.focus(), 30);
  }, [open]);

  const handleClassify = (classification: "known" | "unknown") => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    if (classification === "known") onKnown();
    else onUnknown();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} onClick={onCancel}>
            {copy.cancelLabel}
          </AlertDialogCancel>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleClassify("known")}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {copy.knownLabel}
            </button>
            <button
              type="button"
              onClick={() => handleClassify("unknown")}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {copy.unknownLabel}
            </button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
