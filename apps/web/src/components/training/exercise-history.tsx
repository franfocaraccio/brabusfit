import { ChevronDown, History } from "lucide-react";

import {
  formatShortDate as formatDate,
  HISTORY_PREVIEW,
  historyLabel,
  summarizeHistory,
  type HistoryEntry,
} from "@brabus/shared";

import { cn } from "@/lib/utils";

/** Últimos entrenamientos del ejercicio (desplegable) con "Ver más". */
export function ExerciseHistory({
  history,
  open,
  onToggle,
  onShowAll,
}: {
  history: HistoryEntry[];
  open: boolean;
  onToggle: () => void;
  onShowAll: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
      >
        <History className="size-3.5" />
        {historyLabel(history.length)}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {history.slice(0, HISTORY_PREVIEW).map((h, i) => (
            <HistoryRow key={i} entry={h} />
          ))}
          {history.length > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={onShowAll}
              className="text-primary-text text-xs font-medium hover:underline"
            >
              Ver más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2 text-xs">
      <span className="text-muted-foreground mr-2 font-medium">
        {formatDate(entry.date)}
      </span>
      {summarizeHistory(entry)}
    </div>
  );
}
