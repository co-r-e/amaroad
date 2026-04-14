# Amaroad Cloud PoC — Durable Object Presence

Validates the core realtime tracking architecture for the future `amaroad-cloud` platform:

- **Cloudflare Durable Objects** with **Hibernation API** (handles many idle WebSockets cheaply)
- WebSocket presence for viewers + owner dashboards, keyed by `deckId`
- Self-implemented **canvas + WebGL fingerprint** on the client
- Owner broadcast of viewer join / slide_change / leave events
- WebSocket attachment state that survives DO hibernation

This is a **throwaway** PoC. It intentionally skips auth, persistence, consent, and billing — those belong to the real `amaroad-cloud` repo (see `../../AMAROAD_CLOUD_SPEC.md`).

## Run

```bash
pnpm install
pnpm dev
```

Wrangler will start a local dev server on `http://localhost:8787`. Open multiple browser tabs:

1. **One tab as Owner Dashboard** — click "Join as Owner Dashboard"
2. **One or more tabs as Viewer** — click "Join as Viewer"
3. On a viewer tab, click "Next slide" and watch the owner dashboard update live
4. Close a viewer tab and watch it disappear from the dashboard

Logs stream into the on-page log panel on each tab.

## What this proves

- [x] `ctx.acceptWebSocket(ws, tags)` correctly tags connections with `viewer` / `owner`
- [x] `ctx.getWebSockets(tag)` cleanly returns only the tagged group
- [x] `ws.serializeAttachment()` / `ws.deserializeAttachment()` preserve state across hibernation wakes
- [x] Viewer join / slide_change / close events broadcast only to owner listeners
- [x] Canvas + WebGL fingerprint is stable within a browser session and distinct across browsers / devices (same browser across tabs gives the same fingerprint — the sessionId differentiates tabs instead)
- [x] Owner dashboard receives an accurate snapshot on initial connect
- [x] Multiple viewers on the same deckId share a single DO instance

## What this does NOT cover (by design)

- Auth / session validation (open WebSocket accepts anyone)
- D1 persistence (state lives only in WebSocket attachments)
- `view_sessions` database inserts, 24h dedup, Stripe billing
- Consent screen gating
- Spend cap / bot defense (Turnstile)
- Owner broadcast batching (coalescing on a 500ms timer — needed for webinar scale, not this PoC)
- Alarm-based stale viewer cleanup

These all land in the real `amaroad-cloud` repo phases 2-4.

## Known PoC simplifications

- `deckId` is hard-coded to `test-deck` — no per-deck sharding exercised
- Heartbeat is sent every 15s on viewers and recorded in attachment state, but no alarm-based stale cleanup uses it yet
- No rate limiting on message frequency
- No TypeScript import alias setup (plain relative imports)

## Graduation checklist (when promoting to `amaroad-cloud`)

- [ ] Add auth via Better Auth (require valid session before `acceptWebSocket`)
- [ ] Pass `deckId`, `orgId`, `shareLinkId` from a server-verified token, not query string
- [ ] Replace in-memory attachment with D1-backed `view_sessions` row
- [ ] Add alarm loop for stale cleanup (60s heartbeat timeout)
- [ ] Add owner broadcast batching (500ms coalesce)
- [ ] Add spend cap check before issuing billable event
- [ ] Add Turnstile verification at consent gate (earlier in the flow)
- [ ] Shard strategy for >3000 concurrent viewers on a single deck

## References

- [Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Amaroad Cloud Phase 0-1 Spec](../../AMAROAD_CLOUD_SPEC.md)
