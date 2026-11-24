import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import {
  describeDraft,
  finishedMessage,
  historyLabel,
  progressMessage,
  unfinishedMessage,
  type TrainingExercise,
  type VolumeProgress,
  type WorkoutDraft,
} from "@brabus/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { HistoryRow } from "./exercise-history";

/** Pop-up con título, texto y botones; cerrarlo llama a `onClose`. */
function TrainerDialog({
  open,
  onClose,
  title,
  titleClassName,
  description,
  children,
}: {
  open: boolean;
  titleClassName?: string;
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** "Guardar sesión" con ejercicios sin completar. */
export function UnfinishedDialog({
  open,
  total,
  done,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  done: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <TrainerDialog
      open={open}
      onClose={onClose}
      title="Todavía no terminaste"
      description={unfinishedMessage(total, done)}
    >
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Seguir entrenando
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          {pending ? "Guardando…" : "Guardar igualmente"}
        </Button>
      </DialogFooter>
    </TrainerDialog>
  );
}

/** Series con datos faltantes. */
export function IncompleteDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <TrainerDialog
      open={open}
      onClose={onClose}
      title="⚠️ Faltan datos en algunas series"
      description="¿Guardar igualmente?"
    >
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={onConfirm}>Guardar igual</Button>
      </DialogFooter>
    </TrainerDialog>
  );
}

/** Progresión de volumen contra la última vez. */
export function ProgressDialog({
  progress,
  onClose,
}: {
  progress: { name: string; data: VolumeProgress } | null;
  onClose: () => void;
}) {
  return (
    <TrainerDialog
      open={progress !== null}
      onClose={onClose}
      titleClassName="flex items-center gap-2"
      title={
        <>
          <TrendingUp className="text-success size-5" /> ¡Progresaste!
        </>
      }
      description={
        progress ? progressMessage(progress.name, progress.data) : ""
      }
    >
      <DialogFooter>
        <Button onClick={onClose}>¡Vamos!</Button>
      </DialogFooter>
    </TrainerDialog>
  );
}

/** ¡Rutina completada! */
export function FinishedDialog({
  finished,
  pending,
  onClose,
  onSave,
}: {
  finished: { elapsed: number | null } | null;
  pending: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <TrainerDialog
      open={finished !== null}
      onClose={onClose}
      title="🎉 ¡Rutina completada!"
      description={finishedMessage(finished?.elapsed ?? null)}
    >
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Seguir editando
        </Button>
        <Button onClick={onSave} disabled={pending}>
          {pending ? "Guardando…" : "Guardar entrenamiento"}
        </Button>
      </DialogFooter>
    </TrainerDialog>
  );
}

/** Aviso al salir con cambios sin guardar. */
export function LeaveDialog({
  open,
  onClose,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  return (
    <TrainerDialog
      open={open}
      onClose={onClose}
      title="Los cambios no fueron guardados"
      description={
        <>
          Si salís ahora se pierde lo que cargaste en este entrenamiento. Para
          guardarlo, usá &quot;Guardar sesión&quot;.
        </>
      }
    >
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Seguir entrenando
        </Button>
        <Button variant="destructive" onClick={onLeave}>
          Salir sin guardar
        </Button>
      </DialogFooter>
    </TrainerDialog>
  );
}

/** Sesión anterior sin guardar (la app/pestaña se cerró de golpe). */
export function DraftDialog({
  draft,
  onDiscard,
  onRestore,
}: {
  draft: WorkoutDraft | null;
  onDiscard: () => void;
  onRestore: (draft: WorkoutDraft) => void;
}) {
  return (
    <Dialog open={draft !== null}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Tenés una sesión sin guardar</DialogTitle>
          <DialogDescription>
            {draft ? describeDraft(draft) : ""} ¿Querés continuarla o empezar de
            nuevo?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onDiscard}>
            Descartar
          </Button>
          <Button onClick={() => draft && onRestore(draft)}>
            Continuar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Historial completo de un ejercicio ("Ver más"). */
export function HistoryDialog({
  exercise,
  onClose,
}: {
  exercise: TrainingExercise | null;
  onClose: () => void;
}) {
  return (
    <TrainerDialog
      open={exercise !== null}
      onClose={onClose}
      title={exercise?.name}
      description={exercise ? historyLabel(exercise.history.length) : ""}
    >
      <div className="-mx-1 max-h-[60vh] space-y-1.5 overflow-y-auto px-1">
        {exercise?.history.map((h, i) => (
          <HistoryRow key={i} entry={h} />
        ))}
      </div>
    </TrainerDialog>
  );
}
