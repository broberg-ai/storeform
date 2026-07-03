# StoreForm ↔ Cloud Lens — integrations-kontrakt

Kilde: cardmem intercom **#15611 · #15613 · #15627** (2026-07-03). Fanger den kontrakt cardmem leverede. Vedligeholdes af story **F001.10**.

## Status
**Cloud Lens er LIVE** på `lens.cardmem.com` (headless Chromium, Fly/arn, R2, ships-dark). **G1's DOM-selvheal-lag er SHIPPED + live-bevist (F215.7).**

> **Kontrakten er FROSSEN + bagudkompatibel.** `/flow`-step-grammatikken ændrer sig ikke under os; G1 UDVIDER `target` (string-targets urørte). → Arbejde bygget mod kontrakten er ikke throwaway.

## Endpoints
- **POST `https://lens.cardmem.com/flow`** — header `Authorization: Bearer <LENS_CLOUD_TOKEN>`
  - body: `{ name?, base_url, viewport?/device?, auth?, mutates?, steps:[…] }`
  - `steps[]` actions: `goto{url,waitFor?}` · `click` · `fill{value}` · `type{text}` · `press{key}` · `select{value}` · `expectVisible` · `expectText{text}` · `waitFor{ms?}` · `assert{js:<boolean expr>}` · `upload{target, files:[{name, mimeType?, url? | content_base64?}]}` · `screenshot{name?,mode?}`
  - **`target` = string (CSS/testid) ELLER LocateSpec-objekt (G1, F215.7):**
    `{ testid?, css?, role?, name?, label?, placeholder?, text?, exact?, nth?, vision? }`
    `resolveTarget` prøver de lag du giver i FAST rækkefølge **testid → css → role → label → placeholder → text**; første unikke synlige match vinder.
  - **Hvert step-report får `resolved_via`** (hvilket lag ramte) = vores checkpoint-audit-trail + "degraded match"-signal.
  - `auth: { adapter:'mintEndpoint', url, secret?, body?, headers? }` → target-endpoint returnerer Playwright `storageState` → injiceres før nav.
  - svar: `{ run_id, status:passed|failed, final_url, steps:[{index,action,status,ms,resolved_via?,detail?,error?,screenshot_url?}] }`. **Fejlende step STOPPER flowet + pinner failure-screenshot.**
- **POST `/capture`** · **GET `/artifact?key=…`** (Bearer).

## Token — LEVERES IKKE via intercom
Secrets må aldrig i en besked (Trail-indekseret). To sikre kanaler, vælges når vi rammer et RIGTIGT ASC/Play-run (F001.3):
1. cardmem sætter den som **Fly-secret** på vores app: `flyctl secrets set LENS_CLOUD_TOKEN=… -a <storeform-app>`, eller
2. **cardmem Secrets Vault (F214):** vi henter Secret-ID via `cardmem_get_secret`.
Env: `LENS_CLOUD_TOKEN` (ship-dark). **Lokalt test-form-arbejde (F001.2) kræver ingen token.**

## Capability-map — StoreForms behov 1–8

| # | Behov | Status |
|---|---|---|
| 1 | Ekstern autentificeret URL | ✅ in-scope |
| 2 | Forud-indlogget session | ✅ `mintEndpoint` (inline `storageState` = lille G2, 019f290a) |
| 3 | Self-healing locator (role/label→tekst) | ✅ **SHIPPED — G1 DOM-lag, F215.7** (LocateSpec + resolved_via) |
| 3b | Vision-fallback (screenshot→a11y→vision→koord) | 🟡 **F215.8 fast-follow, ships dark** — aktiv når DOM-lag misser OG `vision`-nøgle sat. Til da: vision-only miss fejler RENT (#7). `LocateSpec.vision` valideres allerede → skriv det i schema nu (inert til F215.8) |
| 4 | Betinget wizard-branching | ⚠️ `assert` findes, ingen branching = **G3** (019f290a) |
| 5 | Checkpoint + resume-from-N | ❌ **G4** (019f290a) |
| 6 | Human-like pacing / anti-bot | ❌ **G5** (019f290a) |
| 7 | Graceful stop (aldrig gæt/indsend) | ✅ in-scope (stopper på fejl + pinner shot) |
| 8 | Baseline pixel-diff (drift) | ❌ **G6** (019f290a, = cardmem F215.6) |

**resolved_via → Upmetrics:** alt der resolver under `testid` (dvs. via css/role/label/placeholder/text) logges som "degraded match" (planens §4.1) — kørslen lykkes, men schemaet trænger måske til opdatering.

## Konsekvens for F001-stories

**Buildable NU:**
- F001.1 (enrollment), F001.10 (denne mapping), F001.2 (schema→`/flow`-pipeline mod lokal test-form, Zone A).
- **F001.3 / F001.6 (rigtige ASC/Play-felter): NU UNGATED på locator-siden** — targettes via `{role/label/text}` (Apple/Google er a11y-web-apps uden testids). Kræver dog cloud-token (se ovenfor) til rigtige runs.
- **F001.5 self-heal:** DOM-lagene virker i dag; kun ren vision (F215.8) er inert.

**Stadig gated:** G3→betinget branching (F001.3/.6 wizard-steps) · G4→F001.4 checkpoint · G5→F001.9 pacing · G6→F001.7 drift · F215.8→ren vision-fallback.

**Bundlinje:** den kritiske sti (G1 self-heal) er FALDET. StoreForm kan ramme rigtige Apple/Google-felter på role/label/text nu; kun rene vision-cases + pacing/checkpoint/drift/branching afventer resterende gaps.
