import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
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
  onConfirm: () => void;
}

export function SkipCardConfirmDialog({
  open,
  flowMode,
  onCancel,
  onConfirm,
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

  const handleConfirm = () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    onConfirm();
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
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}