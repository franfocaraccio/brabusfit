import * as Linking from "expo-linking";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, Logo, Muted, Title } from "@/components/ui";
import { WEB_URL } from "@/lib/config";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth";

/**
 * Usuarios que entraron con Google y todavía no completaron su perfil
 * (username, rol, datos físicos). Por ahora se completa en la web.
 */
export default function CompletarPerfilScreen() {
  const { signOut, refreshProfile } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Logo size={32} />
        <Card style={styles.card}>
          <Title>Completá tu perfil</Title>
          <Muted>
            Antes de empezar necesitamos un par de datos más (nombre de usuario,
            rol y datos físicos). Completalos en la web y volvé a la app.
          </Muted>
          <Button
            title="Completar en la web"
            onPress={() => Linking.openURL(`${WEB_URL}/completar-perfil`)}
          />
          <Button
            title="Ya lo completé"
            variant="outline"
            onPress={refreshProfile}
          />
          <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: "center", padding: 20, gap: 24, alignItems: "stretch" },
  card: { padding: 20, gap: 14 },
});
