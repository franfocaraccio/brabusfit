import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getTrainingDay } from "@brabus/supabase";

import { Trainer } from "@/components/trainer/trainer";
import { Muted } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { makeStyles, useColors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/** El coach no entrena: ve los días desde el detalle de la rutina. */
export default function TrainDayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  if (profile?.is_coach) return <Redirect href={`/rutina/${id}`} />;
  return <TrainDayScreen />;
}

/** Carga el día y monta el entrenador. */
function TrainDayScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { id: routineId, dayId } = useLocalSearchParams<{
    id: string;
    dayId: string;
  }>();
  const { session } = useAuth();
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getTrainingDay>> | undefined
  >(undefined);

  useEffect(() => {
    if (!session) return;
    getTrainingDay(supabase, {
      userId: session.user.id,
      routineId,
      dayId,
    }).then(setData);
  }, [session, routineId, dayId]);

  if (data === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryText} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={styles.center}>
        <Muted>No se encontró este día de la rutina.</Muted>
      </View>
    );
  }

  return (
    <Trainer
      userId={session!.user.id}
      routineId={routineId}
      dayId={dayId}
      dayName={data.day.name}
      exercises={data.exercises}
    />
  );
}

const useStyles = makeStyles((colors) => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
}));
