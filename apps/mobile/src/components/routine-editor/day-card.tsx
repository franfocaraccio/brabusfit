import { Ionicons } from "@expo/vector-icons";
import type { Dispatch } from "react";
import { View } from "react-native";

import {
  emptyRoutineExercise,
  type CatalogEntry,
  type RoutineDayDraft,
  type RoutineDaysAction,
} from "@brabus/shared";

import { Button, Card, TextField } from "@/components/ui";
import { makeStyles, useColors } from "@/lib/theme";

import { ExerciseRow } from "./exercise-row";
import { IconButton } from "./icon-button";

/** Un día de la rutina: nombre, orden, ejercicios y "Agregar ejercicio". */
export function DayCard({
  day,
  index,
  total,
  catalog,
  dispatch,
  newKey,
  onCatalogCreated,
  onPickRest,
}: {
  day: RoutineDayDraft;
  index: number;
  /** Cantidad de días (para deshabilitar bajar/eliminar). */
  total: number;
  catalog: CatalogEntry[];
  dispatch: Dispatch<RoutineDaysAction>;
  newKey: () => string;
  onCatalogCreated: (entry: CatalogEntry) => void;
  /** Abre el selector de descanso de un ejercicio. */
  onPickRest: (exKey: string, value: number | null) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const dayKey = day.key;
  return (
    <Card style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <TextField
            label={`Día ${index + 1}`}
            value={day.name}
            onChangeText={(v) =>
              dispatch({ type: "renameDay", dayKey, name: v })
            }
            placeholder="Día 1 - Piernas"
          />
        </View>
        <IconButton
          icon="chevron-up"
          label="Subir día"
          onPress={() => dispatch({ type: "moveDay", index, delta: -1 })}
          disabled={index === 0}
        />
        <IconButton
          icon="chevron-down"
          label="Bajar día"
          onPress={() => dispatch({ type: "moveDay", index, delta: 1 })}
          disabled={index === total - 1}
        />
        <IconButton
          icon="trash-outline"
          label="Eliminar día"
          onPress={() => dispatch({ type: "removeDay", dayKey })}
          disabled={total === 1}
        />
      </View>

      {day.exercises.map((ex, exIdx) => (
        <ExerciseRow
          key={ex.key}
          exercise={ex}
          catalog={catalog}
          isFirst={exIdx === 0}
          isLast={exIdx === day.exercises.length - 1}
          canRemove={day.exercises.length > 1}
          onChange={(patch) =>
            dispatch({ type: "updateExercise", dayKey, exKey: ex.key, patch })
          }
          onCatalogCreated={onCatalogCreated}
          onPickRest={() => onPickRest(ex.key, ex.rest)}
          onMove={(delta) =>
            dispatch({ type: "moveExercise", dayKey, index: exIdx, delta })
          }
          onRemove={() =>
            dispatch({ type: "removeExercise", dayKey, exKey: ex.key })
          }
        />
      ))}

      <Button
        title="Agregar ejercicio"
        variant="outline"
        onPress={() =>
          dispatch({
            type: "addExercise",
            dayKey,
            exercise: emptyRoutineExercise(newKey),
          })
        }
        icon={<Ionicons name="add" size={18} color={colors.foreground} />}
      />
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  dayCard: { padding: 14, gap: 12 },
  dayHeader: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
}));
