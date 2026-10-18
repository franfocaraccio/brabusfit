# Roadmap / Notas de futuro — Brabus Fit

Ideas y decisiones de arquitectura para más adelante. **Nada de esto está
implementado todavía.** Es una guía para cuando se encare.

---

## 1. App mobile (Android + iPhone)

**Lo clave:** el backend (Supabase: Postgres + Auth + RLS + funciones RPC) se
reutiliza al **100%**. Cualquier cliente le pega con el mismo SDK, así que el
modelo de datos, la seguridad, la auth y la lógica que vive en SQL **no se
reescriben**. Lo único que cambia es la **capa de UI** (Next.js dibuja HTML, no
componentes nativos).

### Opciones

| Opción | Qué se reutiliza | Trade-off |
|--------|------------------|-----------|
| **PWA** (web instalable) | Todo (es la misma web) | Más rápido/barato. Android OK; iPhone con limitaciones (push flojo). No es nativa real. |
| **Capacitor** (envolver la web) | Casi todo (web en caparazón nativo) | Rápido para estar en tiendas, pero es un WebView. |
| **React Native + Expo** ⭐ | Backend + tipos + validaciones + lógica + queries; se reescribe solo la UI | Más trabajo, pero calidad nativa real y una sola base iOS+Android. Camino estándar viniendo de React/TS. |

### Estructura recomendada (con RN + Expo): monorepo (ej. Turborepo)

```
packages/
  types/      -> tipos de la DB (hoy en src/lib/supabase/types.ts)
  supabase/   -> cliente + queries / llamadas a RPC
  logic/      -> validaciones y reglas de negocio
apps/
  web/        -> Next.js actual
  mobile/     -> Expo (UI nativa)
```

> Hoy parte de la lógica está en **server actions** (propias de Next) y parte en
> **RPCs de SQL** (compartidas). En mobile se llama directo a Supabase/RPCs, así
> que la lógica real (que está en la DB) ya es portable; las server actions son
> wrappers finos fáciles de reescribir.

**Sugerencia:** primer salto rápido → **PWA**. App nativa en serio → **RN + Expo**
en monorepo.

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
