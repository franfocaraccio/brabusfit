# Roadmap / Notas de futuro — Brabus Fit

Ideas y decisiones de arquitectura. Cada sección indica si ya está hecha o
pendiente.

---

## 1. App mobile (Android + iPhone) — ✅ base hecha

**Decisión:** mismo repositorio convertido en **monorepo** (npm workspaces +
Turborepo) y app **cross-platform con React Native + Expo** (un solo código para
iOS y Android). Descartados: repo aparte (los tipos de la base se desincronizan),
Flutter (no comparte código), nativo puro (dos apps), Capacitor/PWA (se siente
web; perdemos push, cámara y pasos).

### Hecho
- `apps/web` (Next.js) y `apps/mobile` (Expo SDK 57 + Expo Router).
- `packages/shared` (tipos, validaciones, helpers) y `packages/supabase`
  (consultas y mutaciones que reciben el cliente Supabase): **la lógica de datos
  se escribe una vez** y la usan las dos apps. Las server actions de la web son
  wrappers finos (revalidar caché, redirect, emails).
- Mobile v1: login email/contraseña → rutinas (carpetas coach / lista alumno /
  compartidas / buscador) → días → **entrenar y guardar sesión** (misma lógica
  que la web: precarga de la última sesión, completar rápido, coma decimal,
  detalle, aviso de cambios sin guardar).
- **Paridad con la web (2026-10-18):** registro, login con Google (navegador del
  sistema + PKCE, vuelve a `exp://u.expo.dev/...` en Expo Go), completar perfil,
  perfil editable, inicio + pestañas (Inicio / Rutinas / Alumnos / Perfil),
  crear/editar/eliminar rutinas, carpetas, compartir por email o usuario (con
  validaciones en vivo, pendientes y dejar de compartir) y alumnos con su
  historial. **Regla:** toda funcionalidad nueva va en web y mobile.
- Entorno local con Supabase en Docker (`npm run db:start`, ver SETUP.md) para
  probar todo sin tocar producción.
- **EAS Update** (proyecto `@brabusfit-team/brabus-fit`): `npm run publish` desde
  `apps/mobile` publica la app para abrirla en Expo Go desde cualquier red.

### Pendiente (paso 4 — nativo)
- **Google SSO nativo en mobile** (selector de cuentas del sistema): requiere
  development build, OAuth clients de iOS/Android en Google Cloud. El redirect
  `brabusfit://**` ya está autorizado en Supabase.
- **Emails al compartir desde mobile:** hoy los emails están apagados en las dos
  apps (sin dominio para Resend). Cuando se activen, la mobile tiene que pedirle
  a la web que los envíe (endpoint con el token del usuario): la API key de
  Resend no puede vivir en el teléfono.
- **Notificaciones push** (avisos de progresión, recordatorio del check-in).
- **Cámara** (fotos de progreso / check-in) y **pasos** (Apple Health / Google Fit).
- **Builds y publicación:** EAS Build + EAS Submit (cuentas Apple Developer
  USD 99/año y Google Play USD 25). TestFlight para la beta. Al pasar a builds
  propias, cambiar `runtimeVersion` a `{"policy": "appVersion"}`. Las tiendas
  piden: ícono/capturas, URL de política de privacidad, borrado de cuenta, y
  "Sign in with Apple" si hay login con Google.

---

## 2. Fotos de progreso de los alumnos

**Solución: Supabase Storage** (almacenamiento de objetos S3-compatible, ya
incluido). Mismo ecosistema, misma auth, mismo modelo de seguridad. No suma otro
servicio.

### Diseño

- **Bucket privado** `progress-photos` (nunca público — son fotos sensibles).
- Convención de rutas: `progress-photos/{user_id}/{foto_id}.jpg`.
- **Políticas de Storage (RLS):** el alumno sube/ve sus propias fotos; el coach
  ve las de sus alumnos (reutilizar la lógica tipo `is_my_student`). Nadie más.
- Tabla `progress_photos` con la **metadata** (id, user_id, ruta, fecha, peso,
  nota). La tabla guarda datos + RLS; el bucket guarda la imagen.
- Mostrar con **signed URLs** (links temporales firmados), porque es privado.
- **Comprimir/redimensionar en el cliente** antes de subir (el plan free tiene
  1 GB; las fotos pesan).

**Por qué Storage y no R2 / S3 / Vercel Blob:** misma auth y RLS, un servicio
menos que mantener. El SDK de Storage funciona igual en web y mobile.

---

## 3. Otros pendientes diferidos

- **Emails reales (confirmación de cuenta + aviso de rutina compartida vía
  Resend):** diferido hasta tener un **dominio propio** (el subdominio
  `vercel.app` no sirve para verificar remitente). La ruta `/auth/confirm` ya
  existe; falta dominio → verificar en Resend → activar confirmación + SMTP en
  Supabase.
- **Entorno de staging:** hoy los Preview de Vercel comparten la **DB de prod**
  (variables en "Production and Preview"). Para aislar datos: 2º proyecto
  Supabase + variables de Preview apuntando ahí.

---

## 4. Monetización / SaaS

Arquitectónicamente la app **ya es un SaaS multi-tenant** (cloud, navegador,
aislamiento de datos por tenant vía RLS de Postgres). Falta la capa de negocio:
**ingresos recurrentes (suscripciones)**.

### Modelo sugerido
- **El coach paga; el alumno usa gratis.** Encaja con la relación coach→alumnos
  que ya existe.
- Planes por ejemplo: **Free** (ej. 1-3 alumnos) / **Pro** (alumnos ilimitados,
  features extra como fotos de progreso, estadísticas, etc.).

### Qué haría falta
- **Billing**: integrar **Stripe** (Stripe Checkout + Customer Portal + webhooks).
  Tabla de suscripciones por coach (plan, estado, periodo) sincronizada por
  webhook; RLS/queries que respeten los **límites del plan** (ej. cantidad de
  alumnos / rutinas).
- **Gating de features** según plan (server-side, no solo en UI).
- **Wrapping de producto**: landing/marketing, prueba gratis, términos y
  privacidad, soporte, página de precios.

### Notas
- Es un paso **acotado** sobre lo que ya hay: la base difícil (multi-tenancy +
  RLS + roles coach/alumno) está hecha.
- Stripe funciona bien con Next.js (server actions / route handlers para
  checkout y webhooks) y con Vercel.

---

## 5. Módulos futuros (plan)

Todos encajan en el stack actual (Supabase: Postgres + RLS + Storage + cron;
Next.js en Vercel). Cada uno sigue el mismo patrón: tablas con RLS + archivos en
Storage + (si hace falta) un job programado.

### Entrenamiento avanzado
- **Historial de la rutina:** listar sesiones pasadas (`workout_sessions` →
  `exercise_logs` → `set_logs`) y permitir ver/editar valores. Los datos ya están;
  falta la UI y policies de update sobre sesiones finalizadas.
- **Gráficos de evolución:** queries agregadas por ejercicio/fecha (peso máx.,
  volumen = peso × reps, PRs, frecuencia semanal) + librería de charts (ej.
  Recharts).
- **Alertas de progresión:** regla en SQL (ej. mismo peso N semanas y reps en el
  tope del rango → sugerir subir). Calcular on-the-fly o con `pg_cron` diario
  guardando avisos en una tabla.
- **Fotos/videos de ejercicios:** fotos en Supabase Storage. Videos: opciones
  (a) clips cortos comprimidos en Storage, (b) servicio de video (Mux /
  Cloudflare Stream) si son muchos/largos, (c) links de YouTube/Vimeo no
  listados (costo cero).

### Nutrición
- Plantillas de alimentación del coach (plantilla → comidas → alimentos con
  calorías/macros) asignables a alumnos. Mismo patrón que rutinas
  (owner + share por alumno + RLS). Totales calculados por query.

### Reportes semanales (check-in)
- Tabla de reportes (semana, peso, pasos, notas de entrenamiento, etc.) + fotos
  privadas en Storage.
- "Información requerida por el coach": campos configurables guardados como
  **JSONB** (cada coach define su formulario sin migrar la base).
- Recordatorio semanal con `pg_cron` / Vercel Cron.

### A tener en cuenta
- **Notificaciones:** in-app OK con el stack; email requiere dominio (Resend);
  push en iPhone desde la web solo con PWA instalada (más simple con app nativa).
- **Planes gratuitos:** Supabase Free tiene topes y **pausa proyectos inactivos
  1 semana** → Pro para producción. Vercel Hobby es **no comercial** → Pro al
  monetizar.
