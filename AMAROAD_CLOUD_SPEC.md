# Amaroad Cloud — Phase 0-1 Implementation Spec

> **Scope**: Concrete implementation plan for Phase 0 (foundations) and Phase 1 (PDF upload → ingest → basic viewing) of the `amaroad-cloud` repository.
>
> **Not in scope**: Durable Object presence (Phase 2), consent + share links (Phase 3), billing (Phase 4), notifications (Phase 5), legal (Phase 6), authoring rename integration (Phase 7). Each later phase gets its own spec.
>
> **Target**: 1 engineer, ~3 weeks total (Phase 0 = week 1, Phase 1 = weeks 2-3).
> **Status**: Draft, locked for kickoff. Supersedes earlier exploratory plans in this repo.

## 0. Brand Tokens (Day 1 Locked)

These tokens are used across both the `amaroad` authoring repo and the `amaroad-cloud` cloud platform. Defined once, referenced everywhere.

```css
:root {
  /* Primary ink — dark text, logo dark parts, headings */
  --amaroad-ink: #02001A;

  /* Brand accent — focus, active states, logo "leaf" */
  --amaroad-accent: #009776;
  --amaroad-accent-hover: #007960;
  --amaroad-accent-subtle: rgba(0, 151, 118, 0.08);

  /* Neutrals */
  --amaroad-bg: #F0F2F5;
  --amaroad-surface: #FFFFFF;
  --amaroad-border: #E5E7EB;
  --amaroad-text: #1A1A1A;
  --amaroad-text-muted: #6B7280;
}

.dark {
  /* Ink inverts; accent stays identical */
  --amaroad-ink: #FFFFFF;
  --amaroad-accent: #009776;
  --amaroad-accent-hover: #00B38A;
  --amaroad-accent-subtle: rgba(0, 151, 118, 0.12);

  --amaroad-bg: #0F1117;
  --amaroad-surface: #1A1C24;
  --amaroad-border: #2A2D37;
  --amaroad-text: #E5E7EB;
  --amaroad-text-muted: #9CA3AF;
}
```

**Logo assets**:
- `public/amaroad-logo.svg` — full wordmark, 499×113. Dark parts use `fill="currentColor"`; green parts fixed at `#009776`.
- Inline as React/Svelte component where possible so dark-mode color follows parent `color`.
- `public/favicon.svg` — icon only, 104×113. Dark parts fixed `#02001A`, green fixed `#009776`.

**Typography**: Inter (Latin) + Noto Sans JP (日本語). Heading 700, body 400/500. Mono: Fira Code.

## 1. Repo Layout

```
amaroad-cloud/
├── apps/
│   ├── api/                         # Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── index.ts              # Hono entry
│   │   │   ├── env.ts                # Typed env bindings
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── auth.ts           # Better Auth handler mount
│   │   │   │   ├── orgs.ts
│   │   │   │   └── decks.ts
│   │   │   ├── queues/
│   │   │   │   └── ingest.ts         # PDF → WebP consumer
│   │   │   ├── lib/
│   │   │   │   ├── db.ts             # Drizzle client factory
│   │   │   │   ├── r2.ts             # presigned PUT helper
│   │   │   │   ├── auth.ts           # Better Auth config
│   │   │   │   └── errors.ts
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       └── org.ts
│   │   ├── drizzle/                  # generated SQL migrations
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                         # Svelte 5 + Vite SPA (svelte-spa-router)
│       ├── index.html                # Vite entry HTML
│       ├── src/
│       │   ├── main.ts               # mounts App.svelte
│       │   ├── App.svelte            # root layout + Router (svelte-spa-router)
│       │   ├── router.ts             # route table (URL → Svelte component)
│       │   ├── lib/
│       │   │   ├── api.ts            # typed fetch against api.amaroad.com
│       │   │   ├── auth.ts           # Better Auth svelte client
│       │   │   ├── tokens.css        # brand tokens (§0)
│       │   │   └── components/
│       │   └── routes/               # One Svelte component per URL
│       │       ├── Login.svelte
│       │       ├── Signup.svelte
│       │       ├── AppLayout.svelte      # shared shell for /app/*
│       │       ├── DecksList.svelte      # /app/decks
│       │       ├── DecksUpload.svelte    # /app/decks/upload
│       │       ├── DecksDetail.svelte    # /app/decks/:id
│       │       └── Viewer.svelte         # /v/:token — Phase 1 placeholder
│       ├── vite.config.ts
│       ├── svelte.config.js
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/
│   ├── db/                          # Drizzle schema (source of truth)
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── shared/                      # Zod schemas, API types, constants
│       ├── src/
│       │   ├── api.ts
│       │   ├── ws.ts                 # WebSocket types (Phase 2)
│       │   └── constants.ts
│       └── package.json
│
├── scripts/
│   └── dev-setup.sh
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── biome.json                       # lint + format (faster than ESLint+Prettier)
└── README.md
```

**Tooling versions** (pinned):

| Tool | Version |
|---|---|
| Node | 20.18+ LTS |
| pnpm | 9.x |
| TypeScript | 5.6+ |
| Svelte | 5.x (runes) |
| Vite | 5.x |
| svelte-spa-router | 4.x |
| Hono | 4.x |
| Drizzle ORM | 0.33+ |
| Drizzle Kit | 0.24+ |
| Better Auth | 1.x |
| Wrangler | 3.80+ |
| Zod | 3.x |
| Biome | 1.9+ |

**Do NOT install**: Next.js, React, Vercel SDKs, CloudConvert, FingerprintJS, Supabase, Ably, Pusher.

## 2. Cloudflare Resources (Create First)

```bash
# D1 databases
wrangler d1 create amaroad-prod
wrangler d1 create amaroad-preview

# R2 buckets
wrangler r2 bucket create amaroad-uploads      # raw PDFs
wrangler r2 bucket create amaroad-rendered     # WebP/PNG slide pages

# Queues
wrangler queues create amaroad-ingest
wrangler queues create amaroad-ingest-dlq      # dead letter
```

**`apps/api/wrangler.toml`**:

```toml
name = "amaroad-api"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "amaroad-prod"
database_id = "<fill after create>"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "amaroad-uploads"

[[r2_buckets]]
binding = "RENDERED"
bucket_name = "amaroad-rendered"

[[queues.producers]]
binding = "INGEST_QUEUE"
queue = "amaroad-ingest"

[[queues.consumers]]
queue = "amaroad-ingest"
max_batch_size = 5
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "amaroad-ingest-dlq"

# Secrets (wrangler secret put):
# BETTER_AUTH_SECRET
# FP_SALT
# R2_ACCESS_KEY_ID
# R2_SECRET_ACCESS_KEY
# R2_ACCOUNT_ID
```

**Preview D1 workflow**: the second D1 database (`amaroad-preview`) is wired via `preview_database_id` on the SAME `[[d1_databases]]` block that points to `amaroad-prod`. To apply migrations to the preview DB, run `wrangler d1 migrations apply amaroad-prod --remote --preview` (NOT `--local`; `--local` targets `.wrangler/state/v3/d1` SQLite, not the Cloudflare preview DB). The `d1:migrate:preview` script in `apps/api/package.json` already uses this form.

**Secret usage note**: `FP_SALT` is not used in Phase 0-1 upload/ingest flows. It is reserved for Phase 3 viewer/session fingerprinting and must be mixed in **server-side** before any fingerprint is stored or used for billing, e.g. `sha256(rawFingerprint + ":" + env.FP_SALT)`.

**Custom domains** (one-time, after first deploy):
- `api.amaroad.com` → Workers route
- `app.amaroad.com` → Pages project `amaroad-web`
- `v.amaroad.com` → same Pages project, separate domain binding

## 3. Database Schema (Phase 0 + 1)

**`packages/db/src/schema.ts`** (Drizzle):

```ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─────────── Better Auth tables (generated) ───────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  userIdx: index('session_user_idx').on(t.userId),
}))

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  providerAccountIdx: uniqueIndex('account_provider_account_idx').on(t.providerId, t.accountId),
  userIdx: index('account_user_idx').on(t.userId),
}))

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})

// ─────────── Better Auth organization plugin tables ───────────

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})

export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // owner | admin | member
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  orgUserIdx: uniqueIndex('member_org_user_idx').on(t.organizationId, t.userId),
}))

export const invitation = sqliteTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('pending'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  inviterId: text('inviter_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})

// ─────────── Amaroad extensions ───────────

export const organizationSettings = sqliteTable('organization_settings', {
  organizationId: text('organization_id').primaryKey().references(() => organization.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  billingCountry: text('billing_country').notNull().default('US'),
  monthlySpendCapCents: integer('monthly_spend_cap_cents').notNull().default(10_000),   // Phase 4
  currentMonthSpendCents: integer('current_month_spend_cents').notNull().default(0),     // Phase 4
  currentMonthResetAt: integer('current_month_reset_at', { mode: 'timestamp_ms' }),      // Phase 4
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
})

// ─────────── Phase 1: decks ───────────

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  currentVersionId: text('current_version_id'),
  status: text('status').notNull().default('draft'), // draft | ready | archived
  thumbnailR2Key: text('thumbnail_r2_key'),
  createdBy: text('created_by').notNull().references(() => user.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
}, (t) => ({
  orgCreatedIdx: index('decks_org_created_idx').on(t.organizationId, t.createdAt),
}))

export const deckVersions = sqliteTable('deck_versions', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  originalFormat: text('original_format').notNull().default('pdf'), // pdf | mdx (display-only)
  sourceR2Key: text('source_r2_key').notNull(),
  sourceSizeBytes: integer('source_size_bytes'),
  slidesCount: integer('slides_count'),
  slidesManifest: text('slides_manifest'), // JSON array
  ingestStatus: text('ingest_status').notNull().default('pending'), // pending | processing | ready | failed
  ingestError: text('ingest_error'),
  createdBy: text('created_by').notNull().references(() => user.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
  readyAt: integer('ready_at', { mode: 'timestamp_ms' }),
}, (t) => ({
  deckVersionIdx: uniqueIndex('deck_versions_deck_version_idx').on(t.deckId, t.versionNumber),
}))
```

**First migration**: generate with `pnpm db:generate` — drizzle-kit writes `apps/api/drizzle/NNNN_<random>.sql` plus `meta/_journal.json` and `meta/NNNN_snapshot.json`. Apply to prod D1 with `pnpm db:migrate`, which uses drizzle-kit's `d1-http` driver and reads `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN` env vars. The wrangler-based path also works against the same SQL files: `pnpm --filter @amaroad/api d1:migrate:prod` → `wrangler d1 migrations apply amaroad-prod --remote`. Both approaches share the `drizzle/` output directory.

**Local SQLite mode** (for schema experimentation without touching Cloudflare): `DRIZZLE_USE_LOCAL=1 pnpm db:migrate` uses a local sqlite file under `packages/db/.drizzle-local/`. This path currently requires an additional runtime dependency (`better-sqlite3` or `@libsql/client`) in `packages/db` — NOT installed by default. Install only if you actually need the local-only mode; otherwise stick with the D1 HTTP driver.

**Later phases** (not part of this spec): `share_links`, `view_sessions`, `slide_views`, `consent_records`, `notifications`, `view_events`, `consent_texts`.

## 4. Better Auth Configuration

**`apps/api/src/lib/auth.ts`**:

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@amaroad/db/schema'
import type { Env } from '../env'

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema })

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: 'https://api.amaroad.com',
    trustedOrigins: [
      'https://app.amaroad.com',
      'https://v.amaroad.com',
      'http://localhost:5173',
    ],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Phase 0: off for dev speed, enable in Phase 6
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
        domain: '.amaroad.com',
      },
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 5,
        membershipLimit: 50,
        creatorRole: 'owner',
        invitationExpiresIn: 60 * 60 * 24 * 7,
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
```

**Deployment note**:
- Keep `http://localhost:5173` in `trustedOrigins` / CORS only for local development or preview environments. Omit it from production config.
- `crossSubDomainCookies.domain = '.amaroad.com'` is acceptable only if all `*.amaroad.com` subdomains are under active control. If not, prefer host-only cookies.
- Add production security headers (`Content-Security-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) and Cloudflare WAF/rate-limit rules as a launch hardening task; they are not covered by the Phase 0-1 sample code below.

**Mount in Hono (`apps/api/src/index.ts`)**:

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './lib/auth'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: ['https://app.amaroad.com', 'https://v.amaroad.com', 'http://localhost:5173'],
  credentials: true,
}))

app.get('/health', (c) => c.json({ status: 'ok' }))

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

// ... other routes mounted here

export default {
  fetch: app.fetch,
  queue: ingestQueueConsumer,
} satisfies ExportedHandler<Env>
```

**Svelte client (`apps/web/src/lib/auth.ts`)**:

```ts
import { createAuthClient } from 'better-auth/svelte'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL, // https://api.amaroad.com
  plugins: [organizationClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient
export const orgClient = authClient.organization
```

## 5. API Surface

Error format: `{ error: { code, message } }`. 401 for missing/invalid auth. 403 for cross-org access. 422 for Zod validation failures.

### Phase 0

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | no | Liveness probe |
| POST/GET | `/api/auth/*` | varies | Better Auth handler |
| GET | `/api/me` | yes | Current user + active org |
| GET | `/api/orgs` | yes | User's orgs |
| POST | `/api/orgs/switch` | yes | Change active org |

### Phase 1 (decks)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/decks` | List decks in active org |
| POST | `/api/decks` | Create empty deck |
| GET | `/api/decks/:id` | Deck detail + current version manifest |
| PATCH | `/api/decks/:id` | Update title/description |
| DELETE | `/api/decks/:id` | Archive (soft) |
| POST | `/api/decks/:id/versions/sign` | Presigned R2 PUT URL |
| POST | `/api/decks/:id/versions/complete` | Enqueue ingest |
| GET | `/api/decks/:id/versions` | Version list |

### Example: `POST /api/decks/:id/versions/sign`

**Request**:
```ts
const SignUploadReq = z.object({
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(200 * 1024 * 1024),
  contentType: z.literal('application/pdf'),
})
```

**Response**: `{ versionId, uploadUrl, r2Key }`

**Flow**:
1. Validate via Zod
2. Verify deck belongs to caller's active org
3. Compute next `versionNumber = max(version_number) + 1 for this deck`
4. `crypto.randomUUID()` for versionId
5. `r2Key = 'org/<orgId>/deck/<deckId>/v/<versionId>/source.pdf'`
6. Insert deck_versions row with `ingestStatus='pending'`
7. Presign R2 PUT URL with 10-minute expiry via `aws4fetch`
8. Return

### R2 Presigning

Use `aws4fetch` against R2's S3-compatible endpoint:

```ts
// apps/api/src/lib/r2.ts
import { AwsClient } from 'aws4fetch'

export async function presignR2Put(params: {
  env: Env
  bucket: 'uploads' | 'rendered'
  key: string
  contentType: string
  expiresSec: number
}): Promise<string> {
  const bucketName = params.bucket === 'uploads' ? 'amaroad-uploads' : 'amaroad-rendered'
  const client = new AwsClient({
    accessKeyId: params.env.R2_ACCESS_KEY_ID,
    secretAccessKey: params.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
  const url = `https://${params.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${params.key}?X-Amz-Expires=${params.expiresSec}`
  const signed = await client.sign(
    new Request(url, {
      method: 'PUT',
      headers: { 'content-type': params.contentType },
    }),
    { aws: { signQuery: true } }
  )
  return signed.url
}
```

### Example: `POST /api/decks/:id/versions/complete`

**Request**: `{ versionId: string }`

**Flow**:
1. Verify version is in `pending` state and belongs to caller's org
2. `env.UPLOADS.head(version.sourceR2Key)` — confirm upload succeeded
3. If missing → 422 "upload not found"
4. Update `ingestStatus='processing'`
5. `await env.INGEST_QUEUE.send({ versionId, deckId, orgId })`
6. Return `{ status: 'processing', versionId }`

## 6. Ingest Pipeline (Phase 1 Core)

Queue consumer converts uploaded PDFs into per-page images using **`mupdf-wasm`** and stores them in the `RENDERED` R2 bucket.

**`apps/api/src/queues/ingest.ts`**:

```ts
import * as mupdf from 'mupdf'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '@amaroad/db/schema'

type IngestMessage = {
  versionId: string
  deckId: string
  orgId: string
}

export async function ingestQueueConsumer(
  batch: MessageBatch<IngestMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processIngest(msg.body, env)
      msg.ack()
    } catch (err) {
      console.error('ingest.failed', { versionId: msg.body.versionId, err })
      const db = drizzle(env.DB, { schema })
      await db.update(schema.deckVersions)
        .set({
          ingestStatus: 'failed',
          ingestError: err instanceof Error ? err.message : 'unknown',
        })
        .where(eq(schema.deckVersions.id, msg.body.versionId))
      msg.retry({ delaySeconds: 30 })
    }
  }
}

async function processIngest(body: IngestMessage, env: Env) {
  const db = drizzle(env.DB, { schema })

  await db.update(schema.deckVersions)
    .set({ ingestStatus: 'processing' })
    .where(eq(schema.deckVersions.id, body.versionId))

  const version = await db.query.deckVersions.findFirst({
    where: eq(schema.deckVersions.id, body.versionId),
  })
  if (!version) throw new Error('version_not_found')

  const sourceObj = await env.UPLOADS.get(version.sourceR2Key)
  if (!sourceObj) throw new Error('source_missing')
  const sourceBytes = new Uint8Array(await sourceObj.arrayBuffer())

  const doc = mupdf.PDFDocument.openDocument(sourceBytes, 'application/pdf')
  const pageCount = doc.countPages()
  if (pageCount < 1) throw new Error('empty_pdf')
  if (pageCount > 500) throw new Error('pdf_too_long')

  const targetDpi = 150
  const scale = targetDpi / 72
  const matrix = mupdf.Matrix.scale(scale, scale) /* verify on installed mupdf version */

  const manifest: SlideManifestEntry[] = []

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
    const pngBytes = pixmap.asPNG()

    const pageKey = `org/${body.orgId}/deck/${body.deckId}/v/${body.versionId}/page-${String(i + 1).padStart(4, '0')}.png`
    await env.RENDERED.put(pageKey, pngBytes, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: {
        deckId: body.deckId,
        versionId: body.versionId,
        pageIndex: String(i),
      },
    })

    manifest.push({
      index: i,
      imageKey: pageKey,
      width: pixmap.getWidth(),
      height: pixmap.getHeight(),
    })

    pixmap.destroy()
    page.destroy()
  }

  doc.destroy()

  // Commit atomically: mark ready + update currentVersionId
  await db.batch([
    db.update(schema.deckVersions)
      .set({
        ingestStatus: 'ready',
        slidesCount: pageCount,
        slidesManifest: JSON.stringify(manifest),
        readyAt: Date.now(),
      })
      .where(eq(schema.deckVersions.id, body.versionId)),
    db.update(schema.decks)
      .set({ currentVersionId: body.versionId, status: 'ready' })
      .where(eq(schema.decks.id, body.deckId)),
  ])
}

type SlideManifestEntry = {
  index: number
  imageKey: string
  width: number
  height: number
}
```

**mupdf-wasm notes**:
- Package: `mupdf` on npm
- Requires `compatibility_flags = ["nodejs_compat"]` (set in wrangler.toml)
- Cold start: ~500ms for first invocation — acceptable for Queue consumers
- Worker memory ceiling: 128 MB — covers 500-page PDFs at 150dpi
- PNG output is fine for Phase 1. WebP re-encoding is a Phase 5 optimization (~60% smaller) via `@jsquash/webp`.
- For PDFs >500 pages, return `pdf_too_long` and offer a future Container-based pipeline.

**Progress signaling**: Phase 1 clients poll `GET /api/decks/:id` and handle both terminal states: `status === 'ready'` and `ingestStatus === 'failed'` / `status === 'failed'` (depending on the final API shape). Real-time "deck ready" push is Phase 2 (Durable Objects).

## 7. Web UI (Phase 1)

Svelte 5 + Vite SPA. Routing via **`svelte-spa-router`** (hash-based SPA router). One Svelte component per URL under `src/routes/`, wired up in `src/router.ts`. No SvelteKit conventions (`+page.svelte`, `+layout.svelte`), no SSR, no file-based routing — just `Router` with a URL→component map. Cloudflare Pages serves the build output as a static SPA.

**Brand tokens**: `apps/web/src/lib/tokens.css` imports the block from §0. Loaded in `index.html`.

**Routing note**: because `svelte-spa-router` is hash-based here, the browser-visible URLs are `/#/login`, `/#/signup`, `/#/app/decks`, `/#/app/decks/upload`, `/#/app/decks/:id`, and `/#/v/:token`. The table below lists those real SPA URLs explicitly.

**Routes**:

| Route | Auth | Purpose |
|---|---|---|
| `/#/login` | no | Email + password sign-in |
| `/#/signup` | no | Sign-up + first-run org creation |
| `/#/app/decks` | yes | Deck list in active org |
| `/#/app/decks/upload` | yes | PDF drag & drop upload |
| `/#/app/decks/:id` | yes | Detail + slide grid + version list |
| `/#/v/:token` | no | Phase 1 placeholder viewer (no consent, no tracking) |

### Upload flow (pseudo-Svelte 5)

```svelte
<!-- apps/web/src/routes/DecksUpload.svelte -->
<script lang="ts">
  import { push as goto } from 'svelte-spa-router'
  import { api } from '../lib/api'

  let dragging = $state(false)
  let progress = $state(0)
  let error = $state<string | null>(null)

  async function handleFile(file: File) {
    error = null
    if (file.type !== 'application/pdf') {
      error = 'Only PDF files are accepted'
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      error = 'File must be under 200 MB'
      return
    }

    const deck = await api.decks.create({ title: file.name.replace(/\.pdf$/i, '') })
    const { versionId, uploadUrl } = await api.decks.signVersion(deck.id, {
      fileName: file.name,
      fileSizeBytes: file.size,
      contentType: file.type,
    })

    await uploadWithProgress(uploadUrl, file, (pct) => progress = pct)
    await api.decks.completeVersion(deck.id, { versionId })
    goto(`/app/decks/${deck.id}`)
  }

  function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('content-type', file.type)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_${xhr.status}`)))
      xhr.onerror = () => reject(new Error('upload_network'))
      xhr.send(file)
    })
  }
</script>
```

**`/v/:token` placeholder** (Phase 1 only): fetches the deck by public id (token = deck id temporarily), loads the manifest, renders images in sequence with arrow-key navigation. No consent, no tracking — those land in Phase 3.

## 8. Deployment

```bash
# API (Workers)
cd apps/api
pnpm wrangler deploy                    # production
pnpm wrangler deploy --env preview      # preview

# Web (Pages)
cd apps/web
pnpm build
pnpm wrangler pages deploy dist/ --project-name=amaroad-web
```

**Secrets** (once per env):
```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put FP_SALT
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID
```

## 9. CI/CD

**`.github/workflows/ci.yml`** — runs on every push/PR:
- `pnpm install --frozen-lockfile`
- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r build`

**`.github/workflows/deploy.yml`** — runs on push to `main`:
- Deploy API via `cloudflare/wrangler-action@v3`
- Deploy Web to Pages
- Preview deploys on PRs

**GitHub secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## 10. Phase 0 Checklist (Week 1)

- [ ] Create `amaroad-cloud` repo on GitHub (public or private, decide)
- [ ] Local scaffold: pnpm workspace, Biome, tsconfig.base.json
- [ ] `packages/db`: schema.ts + drizzle-kit config
- [ ] `packages/shared`: skeleton
- [ ] `apps/api`: Hono skeleton with `/health`, env.ts, wrangler.toml
- [ ] `apps/web`: Svelte 5 + Vite + svelte-spa-router skeleton, tokens.css, `/#/login`, `/#/signup`
- [ ] Cloudflare resources created via Wrangler (D1, R2, Queues)
- [ ] Drizzle migration `0000_init.sql` generated and applied to `amaroad-prod`
- [ ] Better Auth configured + `sign-up/email` works end-to-end locally
- [ ] Organization plugin tested: signup → create org → switch active org
- [ ] First deploy: `api.amaroad.com/health` returns 200
- [ ] First deploy: `app.amaroad.com/#/login` renders and accepts credentials
- [ ] CI green on a main-branch push

**DoD**: User signs up at `app.amaroad.com`, creates an organization, sees an empty dashboard.

## 11. Phase 1 Checklist (Weeks 2-3)

- [ ] `decks` + `deck_versions` migration applied
- [ ] `POST /api/decks` create endpoint
- [ ] `POST /api/decks/:id/versions/sign` with R2 presign
- [ ] `POST /api/decks/:id/versions/complete` enqueues ingest
- [ ] `apps/api/src/queues/ingest.ts` mupdf-wasm consumer working
- [ ] `GET /api/decks` + `GET /api/decks/:id` with manifest response
- [ ] Web: upload page (drag & drop + XHR progress)
- [ ] Web: deck list page
- [ ] Web: deck detail page with slide grid + polling on `status`
- [ ] Web: `/#/v/:token` viewer placeholder (image sequence + arrow keys)
- [ ] End-to-end test: PDF up → ingest → view
- [ ] Size matrix: 1, 20, 100, 500 page PDFs all work

**DoD**: Logged-in user drags a PDF onto the upload page, sees ingest complete, opens `/#/v/:token` in an incognito tab and navigates all slides.

## 12. Later Phase Pointers

| Phase | Scope | Spec status |
|---|---|---|
| 2 | Durable Object presence (Hibernation API) + live dashboard | Separate spec |
| 3 | Strict consent + share_links (personal/broadcast) + canvas fingerprint | Separate spec |
| 4 | Stripe metered + 24h dedup + spend cap | Separate spec |
| 5 | Slack/email notifications + per-slide heatmap + WebP re-encode | Separate spec |
| 6 | Legal + CCPA + DSR API | Start drafting at Phase 0 |
| 7 | DexCode→amaroad rename completion + `amaroad publish` CLI + i18n | Touches authoring repo |
| 8 | Webinar scale test + security audit + pen test | — |

Keep this document frozen after kickoff — create follow-up specs for each later phase rather than editing this one.
