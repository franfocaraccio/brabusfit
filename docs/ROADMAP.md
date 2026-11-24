# Roadmap and decisions

Pending work lives in **[GitHub Issues](https://github.com/franfocaraccio/brabusfit/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)**. This file keeps two things:
- what is planned, grouped by area
- the main architecture decisions and how the product got here

## Planned

| Area | Issues |
|---|---|
| Check-ins | #17 Weekly check-ins · #18 Progress photos (private Storage) |
| Clients | #19 Payments and due dates · #20 Coach dashboard: check-ins and fees due |
| Training | #21 Exercise photos · #22 Exercise videos · #23 Progression alerts |
| Nutrition | #24 Students edit their own plans · #25 Food catalog, meals done, shopping list |
| Mobile | #26 Native builds and store release (push, camera, steps, native Google sign-in) |
| Infra | #27 Transactional email (own domain) · #28 Staging environment · #29 Subscriptions and billing · #30 Drop `exercises.name` |

## Architecture decisions

### One monorepo, React Native + Expo for mobile
The web app became an npm-workspaces + Turborepo monorepo, and the mobile app shares its data layer and types. Alternatives considered and discarded:
- **A separate repo:** the database types drift.
- **Flutter:** shares no code with the web.
- **Two native apps:** double the work.
- **Capacitor / PWA:** feels like a website and loses push notifications, camera and steps.

### Data layer as plain functions that receive the client
`packages/supabase` exports functions like `createRoutine(client, payload)`. The web calls them from Server Actions (adding cache revalidation and redirects); the mobile app calls them directly. Business rules are written once.

### Security in the database
Row Level Security and `SECURITY DEFINER` SQL functions decide who can read and write what. That's why the mobile app can ship only the publishable key; the secret key exists only on the web server. Writes that touch several tables are SQL functions, so they run in one transaction.

### Templates and per-client copies, never shared references
*(migrations 0010–0013)* A coach's routine without a client is a template. Assigning it creates an independent copy for that client, which the coach can tailor without touching anyone else's. The same model applies to nutrition plans, and will apply to check-ins.

When an active link ends, whoever ends it, the student gets their own copy of every routine and plan, and their workout history moves with it. The coach keeps theirs under the unlinked client. Cancelled or rejected invitations leave nothing behind.

### Clients exist without the app
*(0012)* `coach_students` is the coach's file on a client (contact, body data, goal, private notes). It exists even if the person never installs the app; routines and plans export to PDF and Excel. App access is optional in the same row (`none` / `pending` / `active`). Students never read that table, because it holds private notes; they get their coaches through `get_my_coaches()`.

### Exercise catalog
*(0008)* A general catalog of about 120 exercises by muscle group, plus custom entries visible only to their owner. Routines reference the catalog, so progress groups the same exercise across routines.

### Pure logic in `packages/shared`
Progress stats, macro totals, the workout reducer, the routine and plan editors, the local workout draft, and the PDF/XLSX data are pure TypeScript with unit tests, and both apps use them. Charts are hand-written SVG and the `.xlsx` writer has no dependencies.

### Workout drafts stay on the device
Each saved or completed exercise writes a local draft. If the app closes, the student is offered to continue that session for 24 hours. Drafts never reach the database.

### Progress photos in Supabase Storage (planned)
They'll go in a private bucket with Storage policies built on the same helpers as RLS, metadata in a table, and signed URLs to display them. Storage was chosen over S3, R2 or Vercel Blob because it shares the auth and RLS model and means one service less (#18).

### Migrations and types
- Migrations are the only source of truth for the schema.
- Types are generated from them, and CI fails if they drift.
- Production migrations run only through a manual, environment-protected workflow with a dry run first.

## History

| When (2026) | Change |
|---|---|
| Oct | Mobile app (Expo) at parity with the web; EAS Update for Expo Go |
| Oct | Session history editable after the fact (0007) |
| Oct | Progress charts: records, estimated 1RM, max weight, weekly volume and frequency |
| Oct | Local workout drafts |
| Oct | Exercise catalog (0008) |
| Oct | Explicit coach ↔ student link with invitations (0009) |
| Oct | Per-student routines + templates, replacing sharing (0010) |
| Oct | Students keep their routines when unlinked (0011) |
| Oct | Clients CRM and PDF/Excel export (0012) |
| Oct | Nutrition plans (0013) |
| Oct | Current routine/plan and the student home (0014) |
| Nov | Rest timer per exercise, logged variant, workout timer (0015) |
| Nov | Portfolio pass: tests, CI, generated types, refactor, docs, E2E |
