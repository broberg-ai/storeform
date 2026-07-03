# StoreForm ↔ Cloud Lens — integrations-kontrakt

Kilde: cardmem intercom **#15611** (2026-07-03). Denne fil fanger den kontrakt cardmem leverede, så den ikke går tabt. Vedligeholdes af story **F001.10**.

## Status
**Cloud Lens er LIVE** på `lens.cardmem.com` (headless Chromium, Fly/arn, R2-storage, ships-dark). Kan targettes i dag.

## Endpoints
- **POST `https://lens.cardmem.com/flow`** — header `Authorization: Bearer <LENS_CLOUD_TOKEN>`
  - body: `{ name?, base_url, viewport?/device?, auth?, mutates?, steps:[…] }`
  - `steps[]` actions: `goto{url,waitFor?}` · `click` · `fill{value}` · `type{text}` · `press{key}` · `select{value}` · `expectVisible` · `expectText{text}` · `waitFor{ms?}` — **target = CSS-selector ELLER bare data-testid** · `assert{js:<boolean expr>}` · `upload{target, files:[{name, mimeType?, url? | content_base64?}]}` · `screenshot{name?,mode?}`
  - `auth: { adapter:'mintEndpoint', url, secret?, body?, headers? }` → target-endpoint returnerer Playwright `storageState` → injiceres før nav.
  - svar: `{ run_id, status:passed|failed, final_url, steps:[{index,action,status,ms,detail?,error?,screenshot_url?}] }`. **Fejlende step STOPPER flowet + pinner et failure-screenshot.**
- **POST `/capture`** — enkelt-shots
- **GET `/artifact?key=…`** — henter et shot (Bearer)
- **Token:** leveres via buddy secure channel — **ALDRIG i chat**. Env-navn: `LENS_CLOUD_TOKEN` (ship-dark i `.env`).

## Capability-map — StoreForms behov 1–8

| # | Behov | Status | Gap |
|---|---|---|---|
| 1 | Ekstern autentificeret URL | ✅ in-scope | — |
| 2 | Forud-indlogget session | ⚠️ delvist | `mintEndpoint` virker i dag; inline `storageState` = **G2** (lille) |
| 3 | Self-healing locator (role/label→tekst→vision) | ❌ GAP | **G1 — KRITISK, kernen i self-heal** |
| 4 | Betinget wizard-branching | ⚠️ delvist | `assert` findes, ingen branching = **G3** |
| 5 | Checkpoint + resume-from-N | ❌ GAP | **G4** |
| 6 | Human-like pacing / anti-bot | ❌ GAP | **G5** |
| 7 | Graceful stop (aldrig gæt/indsend) | ✅ in-scope | stopper på første fejl + pinner shot |
| 8 | Baseline pixel-diff (drift) | ❌ GAP | **G6** (= cardmem F215.6 backlog) |

**Gaps ejes af cardmem** (idé `019f290a` → promoveres til `F215.7+` med plans). Bygges INDE i Lens — **ingen Playwright-workaround hos os**. Bedt cardmem splitte **G1** ud som egen F215.x (kritisk sti); G3–G6 samlet.

## Konsekvens for F001-stories

**Buildable NU** (mod stabile targets / en lokal test-form med `data-testid`):
- F001.1 (enrollment), F001.10 (denne mapping), F001.2 (schema→`/flow`-pipeline mod lokal test-form), samt dele af F001.3/F001.6 hvor selectors tilfældigvis er stabile.
- Auth via `mintEndpoint` (G2's inline-variant er nice-to-have).

**GATED på cardmem-gaps** (rigtige Apple/Google-kørsler):
- **G1 → F001.2 / F001.5** self-heal mod Apples/Googles ustabile DOM. **Kritisk sti:** uden G1 rammer vi kun stabile selectors — men Apple/Google har ingen, hvilket er præcis problemet StoreForm løser.
- **G3 → F001.3 / F001.6** betingede wizard-steps.
- **G4 → F001.4** checkpoint/resume.
- **G5 → F001.9** pacing.
- **G6 → F001.7** drift-pixel-diff.

**Bundlinje:** vi kan komme i gang med pipelinen mod en lokal test-form i dag; StoreForms rigtige værdi mod Apple/Google er gated på især **G1**.
