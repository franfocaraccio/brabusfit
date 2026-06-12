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
