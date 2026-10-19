import { Alert, Platform } from "react-native";

/**
 * Diálogo de confirmación. En el teléfono usa Alert nativo; en el navegador
 * (pruebas locales) window.confirm, porque Alert no existe en react-native-web.
 */
export function confirm({
  title,
  message,
  confirmText,
  cancelText = "Cancelar",
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  if (Platform.OS === "web") {
    if (window.confirm([title, message].filter(Boolean).join("\n\n"))) onConfirm();
    else onCancel?.();
    return;
  }
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: "cancel", onPress: onCancel },
      { text: confirmText, style: destructive ? "destructive" : "default", onPress: onConfirm },
    ],
    { cancelable: false },
  );
}

/** Aviso simple (un botón). */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert([title, message].filter(Boolean).join("\n\n"));
    return;
  }
  Alert.alert(title, message);
}
