// Corre un comando con las variables de un archivo .env cargadas en el proceso
// (tienen prioridad sobre .env/.env.local de Next y Expo).
// Uso (desde un script de npm): node ../../scripts/with-env.mjs .env.localdb next dev
import { spawn } from "node:child_process";

const [file, ...command] = process.argv.slice(2);
if (!file || command.length === 0) {
  console.error("Uso: node with-env.mjs <archivo-env> <comando> [...args]");
  process.exit(1);
}

process.loadEnvFile(file);

const child = spawn(command.join(" "), { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
