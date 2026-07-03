# StoreForm ↔ Cloud Lens — integrations-kontrakt

Kilde: cardmem intercom **#15611 + #15613** (2026-07-03). Denne fil fanger den kontrakt cardmem leverede, så den ikke går tabt. Vedligeholdes af story **F001.10**.

## Status
**Cloud Lens er LIVE** på `lens.cardmem.com` (headless Chromium, Fly/arn, R2-storage, ships-dark). Kan targettes i dag.

> **Kontrakten er FROSSEN.** `/flow`-step-grammatikken ændrer sig ikke under os. G1 (self-heal) **udvider** `target`-opløsningen — den **bryder ikke** eksisterende selector/testid-baserede flows. → Arbejde bygget mod kontrakten nu er ikke throwaway.

## Endpoints
- **POST `https://lens.cardmem.com/flow`** — header `Authorization: Bearer <LENS_CLOUD_TOKEN>`
  - body: `{ name?, base_url, viewport?/device?, auth?, mutates?, steps:[…] }`
  - `steps[]` actions: `goto{url,waitFor?}` · `click` · `fill{value}` · `type{text}` · `press{key}` · `select{value}` · `expectVisible` · `expectText{text}` · `waitFor{ms?}` — **target = CSS-selector ELLER bare data-testid** · `assert{js:<boolean expr>}` · `upload{target, files:[{name, mimeType?, url? | content_base64?}]}` · `screenshot{name?,mode?}`
  - `auth: { adapter:'mintEndpoint', url, secret?, body?, headers? }` → target-endpoint returnerer Playwright `storageState` → injiceres før nav.
  - svar: `{ run_id, status:passed|failed, final_url, steps:[{index,action,status,ms,detail?,error?,screenshot_url?}] }`. **Fejlende step STOPPER flowet + pinner et failure-screenshot.**
- **POST `/capture`** — enkelt-shots
- **GET `/artifact?key=…`** — henter et shot (Bearer)

## Token — LEVERES IKKE via intercom
En secret må aldrig i en besked (Trail-indekseret). To sikre kanaler, vælges når vi nærmer os et RIGTIGT ASC/Play-run:
1. cardmem sætter den direkte som **Fly-secret** på vores app: `flyctl secrets set LENS_CLOUD_TOKEN=… -a <storeform-app>` (når appen er deployet), eller
2. **cardmem Secrets Vault (F214):** vi henter et Secret-ID via `cardmem_get_secret`.
Env-navn i begge tilfælde: `LENS_CLOUD_TOKEN` (ship-dark). **Ingen cloud-token nødvendig for lokalt test-form-arbejde** (stabile testids + mintEndpoint).

## Capability-map — StoreForms behov 1–8

| # | Behov | Status | Gap (owner=cardmem) |
|---|---|---|---|
| 1 | Ekstern autentificeret URL | ✅ in-scope | — |
| 2 | Forud-indlogget session | ⚠️ delvist | `mintEndpoint` virker i dag; inline `storageState` = **G2** (lille, i 019f290a) |
| 3 | Self-healing locator (role/label→tekst→vision) | ❌ GAP | **G1 — KRITISK — egen idé `019f2910`** → F215.7 |
| 4 | Betinget wizard-branching | ⚠️ delvist | `assert` findes, ingen branching = **G3** (019f290a) |
| 5 | Checkpoint + resume-from-N | ❌ GAP | **G4** (019f290a) |
| 6 | Human-like pacing / anti-bot | ❌ GAP | **G5** (019f290a) |
| 7 | Graceful stop (aldrig gæt/indsend) | ✅ in-scope | stopper på første fejl + pinner shot |
| 8 | Baseline pixel-diff (drift) | ❌ GAP | **G6** (019f290a, = cardmem F215.6) |

**G1-scope (per cardmem):** layered role/label (`getByRole`/`getByLabel`) → visible-text fuzzy → vision-fallback (screenshot+a11y-tree → `@broberg/ai-sdk` vision-tier → element/koordinat), **emitter hvilket lag der ramte** (til vores checkpoint-log), vision ship-dark. Bygges INDE i Lens — ingen Playwright-workaround hos os.

## Konsekvens for F001-stories

**Buildable NU** (mod en lokal test-form med stabile `data-testid`, ingen cloud-token krævet):
- F001.1 (enrollment), F001.10 (denne mapping), F001.2 (schema→`/flow`-pipeline mod lokal test-form), auth-laget via `mintEndpoint`.

**GATED på cardmem-gaps** (rigtige Apple/Google-kørsler):
- **G1 (019f2910) → F001.2 / F001.5** self-heal mod Apples/Googles ustabile DOM. **Kritisk sti:** uden G1 rammer vi kun stabile targets — men Apple/Google har ingen, hvilket er præcis problemet StoreForm løser.
- **G3 → F001.3 / F001.6** betingede wizard-steps · **G4 → F001.4** checkpoint · **G5 → F001.9** pacing · **G6 → F001.7** drift-pixel-diff.

**Bundlinje:** vi kan bygge hele pipelinen mod en lokal test-form i dag uden rework-risiko (frossen kontrakt); StoreForms værdi mod Apple/Google er gated på især **G1 (019f2910)**.
