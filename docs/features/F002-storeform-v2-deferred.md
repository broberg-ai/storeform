# F002 — StoreForm v2 (deferred scope)

Status: Backlog (post-PoC) · Ejer: Christian / Broberg AI

> Samlingspunkt for alt der bevidst er UDENFOR v1 (epic F001). Oprettet 2026-07-03 på Christians ønske om at de ucovered/deferrede ting ligger som rigtige kort, ikke kun som prosa i v1-planens §7. **Intet her kodes før v1 (F001) er valideret.**

## Stories

| Story | Feature | Hvorfor deferred |
|---|---|---|
| **F002.1** | Login/2FA + session-injection | v1 forudsætter manuel login; automatisér auth (cookie/storage-state-injection) så kørsler kan starte uden manuel indlogning |
| **F002.2** | Auto-submit ("send til review"/publish) | v1 stopper bevidst FØR den irreversible indsendelse; automatisér det sidste step med ekstra guardrails |
| **F002.3** | Scheduled/automatisk kørsel | v1 køres manuelt via CLI; tilføj scheduled trigger (Claude Code Remote routine / cronjobs.webhouse.net + buddy schedule_job) |
| **F002.4** | Visuel schema-editor | v1 redigerer schemaer som filer; byg web-UI til at forfatte/redigere schemaer visuelt |
| **F002.5** | Monitoring-web-UI (Hono) + Lens-foundry | valgfrit overvågnings-UI; kræver egen data-testid-foundry for at være Lens-verificerbart |
| **F002.6** | Pakke-split til @storeform/* | v1 er én Bun-pakke; split til monorepo (@storeform/engine / cli / schemas) når en 2. consumer opstår |

Alle stories bærer egne acceptance criteria (se kortene). Afhængigheder sættes når de promoveres til aktivt arbejde.
