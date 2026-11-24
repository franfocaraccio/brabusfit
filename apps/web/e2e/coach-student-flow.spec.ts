import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Recorrido completo con los usuarios del seed local:
 * el coach crea una plantilla → la asigna a su cliente → el alumno la
 * entrena y guarda la sesión → el coach ve el entrenamiento en la ficha.
 *
 * Usa un nombre único por corrida, así se puede repetir sin `db:reset`.
 */

// Usuarios de supabase/seed.sql (solo existen en el Supabase local).
const PASSWORD = "brabus-test-123";
const COACH = "coach@brabus.test";
const STUDENT = "alumno@brabus.test";
const CLIENT_NAME = "Andrés Alumno";
const CLIENT_ID = "f1000000-0000-0000-0000-000000000001";

const stamp = Date.now().toString(36);
const ROUTINE = `E2E ${stamp}`;
const DAY = `Día E2E ${stamp}`;
const EXERCISE = "Sentadilla goblet";

test.describe.configure({ mode: "serial" });

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/dashboard");
  return page;
}

test("el coach crea una plantilla y la asigna a su cliente", async ({
  browser,
}) => {
  const page = await signIn(browser, COACH);
  await page.goto("/rutinas/crear");

  await page.getByLabel("Nombre de la rutina").fill(ROUTINE);
  // Plantilla (por defecto) → elegir carpeta.
  await page
    .getByRole("combobox")
    .filter({ hasText: "Elegí una carpeta" })
    .click();
  await page.getByRole("option", { name: "Fuerza" }).click();

  await page.getByLabel("Día 1").fill(DAY);
  await page.getByRole("button", { name: "Elegí un ejercicio" }).click();
  await page.getByPlaceholder("Buscar ejercicio…").fill(EXERCISE);
  await page.getByRole("button", { name: new RegExp(`^${EXERCISE}`) }).click();
  await page.getByLabel("Series y repeticiones").fill("3x10");

  await page.getByRole("button", { name: "Crear rutina" }).click();
  await page.waitForURL(/\/rutinas\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: ROUTINE, exact: true }),
  ).toBeVisible();

  // Asignar: crea la copia del cliente y navega a ella.
  const templateUrl = page.url();
  await page.getByRole("button", { name: "Asignar a cliente" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(CLIENT_NAME) })
    .click();
  await page.waitForURL((url) => url.href !== templateUrl);
  await expect(page.getByText(CLIENT_NAME).first()).toBeVisible();
  await page.close();
});

test("el alumno entrena la rutina y guarda la sesión", async ({ browser }) => {
  const page = await signIn(browser, STUDENT);
  await page.goto("/rutinas");
  await page.getByText(ROUTINE).first().click();
  await page.getByText(DAY).click();
  await page.waitForURL(/\/dia\//);

  await page.getByText(EXERCISE, { exact: true }).click();
  await page.getByPlaceholder("Peso").fill("50");
  await page.getByPlaceholder("Reps").fill("10");
  await page.getByRole("button", { name: "Guardar ejercicio" }).click();

  // Era el único ejercicio: aparece "¡Rutina completada!".
  const finished = page.getByRole("dialog");
  await expect(finished.getByText("¡Rutina completada!")).toBeVisible();
  await finished.getByRole("button", { name: "Guardar entrenamiento" }).click();

  await expect(page.getByText("Sesión guardada")).toBeVisible();
  await page.waitForURL(/\/rutinas\/[0-9a-f-]{36}$/);
  await page.close();
});

test("el coach ve el entrenamiento en la ficha del cliente", async ({
  browser,
}) => {
  const page = await signIn(browser, COACH);
  await page.goto(`/clientes/${CLIENT_ID}`);
  await page
    .getByRole("button", { name: "Entrenamientos", exact: true })
    .click();

  const session = page.getByRole("link", { name: new RegExp(ROUTINE) });
  await expect(session).toBeVisible();
  await expect(session).toContainText(DAY);
  await expect(session).toContainText(EXERCISE);
  await expect(session).toContainText("50kg × 10");
  await page.close();
});
