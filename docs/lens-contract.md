# StoreForm ↔ Cloud Lens — integrations-kontrakt

Kilde: cardmem intercom **#15611 · #15613 · #15627 · #15642** (2026-07-03). Fanger den kontrakt cardmem leverede. Vedligeholdes af story **F001.10**.

## Status
**Cloud Lens er LIVE** på `lens.cardmem.com` (headless Chromium, Fly/arn, R2, ships-dark). **G1 (self-heal) er KOMPLET — alle 3 lag live: DOM-lag (F215.7) + vision-fallback (F215.8).**

> **Kontrakten er FROSSEN + bagudkompatibel.** `/flow`-step-grammatikken ændrer sig ikke under os; G1 UDVIDER `target` (string-targets urørte). → Arbejde bygget mod kontrakten er ikke throwaway.

## Endpoints
- **POST `https://lens.cardmem.com/flow`** — header `Authorization: Bearer <LENS_CLOUD_TOKEN>`
  - body: `{ name?, base_url, viewport?/device?, auth?, mutates?, steps:[…] }`
  - `steps[]` actions: `goto{url,waitFor?}` · `click` · `fill{value}` · `type{text}` · `press{key}` · `select{value}` · `expectVisible` · `expectText{text}` · `waitFor{ms?}` · `assert{js:<boolean expr>}` · `upload{target, files:[{name, mimeType?, url? | content_base64?}]}` · `screenshot{name?,mode?}`
  - **`target` = string (CSS/testid) ELLER LocateSpec-objekt:**
    `{ testid?, css?, role?, name?, label?, placeholder?, text?, exact?, nth?, vision? }`
    `resolveTarget` prøver de lag du giver i FAST rækkefølge **testid → css → role → label → placeholder → text → vision**; første unikke synlige match vinder.
  - **Hvert step-report får `resolved_via`** (testid|css|role|label|placeholder|text|vision) = checkpoint-audit-trail + degraded-match-signal (vision = laveste tillid).
  - `auth: { adapter:'mintEndpoint', url, secret?, body?, headers? }` → returnerer Playwright `storageState` → injiceres før nav.
  - svar: `{ run_id, status:passed|failed, final_url, steps:[{index,action,status,ms,resolved_via?,detail?,error?,screenshot_url?}] }`. **Fejlende step STOPPER + pinner failure-screenshot.**
- **POST `/capture`** · **GET `/artifact?key=…`** (Bearer).

### Verificeret live (F001.2, 2026-07-04)
- **Sky-`/flow` auto-navigerer IKKE til `base_url`.** Modsat den lokale daemon-MCP (`lens_run_flow`, som selv åbner `base_url`) starter sky-`/flow` på en blank side → uden et ledende `goto`-step fejler step 0 med `locate: no layer matched`. **Motoren (`buildFlow`) injicerer derfor et `goto base_url`-step når schemaet ikke selv åbner med `goto`.** Relativ `goto {url:'/'}` resolver mod `base_url`, så et enkelt deep-path-`goto` (fx `/apps/{id}/version`) rækker til ASC.
- **Self-heal bekræftet mod sky-Lens:** Zone-B (ingen testids) fyldt 100% via `resolved_via` = `role` / `label` / `text` (lag 1+2). Kræver `LENS_CLOUD_TOKEN` (Bearer) — den LOKALE daemon kan kun testid/CSS, så role/label/text-self-heal SKAL bevises på sky-Lens.
- **Cold-start:** første kald efter idle ~6s (health-prewarm i `@broberg/lens-client` håndterer 502-retry).

## Vision-fallback (F215.8) — Set-of-Marks
Rå koordinat-genkendelse er UPÅLIDELIG (modeller peger skævt) → ville bryde #7. I stedet: markér alle klikbare felter med **nummererede badges** → spørg modellen HVILKET NUMMER der matcher → klik det RIGTIGE DOM-element på dets center. Returnerer et ægte element (virker for ALLE actions), fejler RENT ved no-match. Rute = Gemini-2.5-flash via OpenRouter (cardmem's nøgle), env-overridable (`LENS_VISION_PROVIDER`/`LENS_VISION_MODEL`).
**Ships dark:** inaktiv indtil en vision-nøgle sættes på lens-appen. **Aktivering = Christians go** (det tænder vision-forbrug/omkostning) — sker SAMTIDIG med at vi får `LENS_CLOUD_TOKEN`, ved **F001.3** (første rigtige ASC-run).

## Token + vision-nøgle — LEVERES IKKE via intercom
Secrets aldrig i en besked (Trail-indekseret). `LENS_CLOUD_TOKEN` blev leveret 2026-07-04 (cardmem #15918, vej b: skrevet direkte i vores gitignorede `.env`, piped fra keychain). **Zone-B role/text/label-self-heal (F001.2) KØRER på sky-Lens og KRÆVER token'en** — kun testid/CSS via den lokale daemon er token-fri. Vision-nøglen (F215.8) er stadig OFF (opt-in per capture) — tændes først på Christians go hvis en rigtig kørsel misser på DOM-lagene.

## Capability-map — StoreForms behov 1–8

| # | Behov | Status |
|---|---|---|
| 1 | Ekstern autentificeret URL | ✅ |
| 2 | Forud-indlogget session | ✅ `mintEndpoint` (inline `storageState` = lille G2, 019f290a) |
| 3 | Self-healing locator (role/label→tekst→vision) | ✅ **KOMPLET — G1 alle 3 lag (F215.7 + F215.8)** |
| 4 | Betinget wizard-branching | ⚠️ `assert` findes, ingen branching = **G3** (019f290a) |
| 5 | Checkpoint + resume-from-N | ❌ **G4** (019f290a) |
| 6 | Human-like pacing / anti-bot | ❌ **G5** (019f290a) |
| 7 | Graceful stop (aldrig gæt/indsend) | ✅ (stopper på fejl + pinner shot; vision-no-match fejler rent) |
| 8 | Baseline pixel-diff (drift) | ❌ **G6** (019f290a, = cardmem F215.6) |

**resolved_via → Upmetrics:** alt der resolver under `testid` = "degraded match" (planens §4.1); **vision = stærkeste degraded-signal** (schema-felt trænger til bedre role/label/text-nøgle).

## Konsekvens for F001-stories

**Buildable NU:** F001.1, F001.10, F001.2 (pipeline mod lokal test-form, Zone A + Zone-B ROLE/TEXT).
**Ungated på locator-siden (kræver token + evt. vision-nøgle ved rigtige runs):** F001.3 / F001.6 (rigtige ASC/Play-felter via role/label/text, vision som sidste udvej), F001.5 (self-heal fuldt).
**Stadig gated på øvrige gaps:** G3 → betinget branching (F001.3/.6 wizard-steps) · G4 → F001.4 checkpoint · G5 → F001.9 pacing · G6 → F001.7 drift.

**Bundlinje:** hele den kritiske sti (G1 self-heal, alle 3 lag) er FALDET. StoreForm kan ramme rigtige Apple/Google-felter på role/label/text/vision. Tilbage: branching, checkpoint, pacing, drift — plus Christians go + token/vision-nøgle ved første rigtige run.
