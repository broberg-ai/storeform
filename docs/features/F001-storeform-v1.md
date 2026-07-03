# F001 — StoreForm v1
**Selvhelende formular-automation for App Store Connect & Google Play Console**

Status: Adopteret i cardmem (Branch B) · Draft v1
Ejer: Christian / WebHouse / Broberg AI
Kilde-plan: `@asset:019f28d5-5581-71e3-9494-668a5efc5c9f` (storeform-v1-plan.md, 2026-07-01)

> **Adoption- + revisions-note (2026-07-03):** Christians spec-asset blev adopteret som epic F001 + stories.
> - **§8 bekræftet af Christian** (én Bun-pakke nu, manuel CLI-trigger til v1, Upmetrics/Discovery-enrollment som setup-story før motoren). Se §8.
> - **Arkitektur-revision (Christians direktiv):** browser-driving sker via **cloud Lens** (cardmem's kommende cloud-udgave af Lens), **ikke rå Playwright**. StoreForm er schema- + orkestrerings-laget der DRIVER Lens; de browser-nære capabilities (lagdelte locators, vision-fallback, pacing) hører til Lens. Mangler Lens noget → **file gap til cardmem** (F112-vejen), aldrig hånd-rullet Playwright. Gap filed 2026-07-03 (intercom #15608). Se §4 + story F001.10.

---

## 1. Problem

Manuel udfyldning af release-/submission-formularer i App Store Connect og Google Play Console er gentaget, fejlfølsomt arbejde. Almindelige record-and-replay scripts brækker konstant fordi:

- Begge platforme er bygget i React/Material med ustabile, genererede class-navne — ingen `data-testid` at holde fast i
- Multi-step wizards med betinget felt-logik (felt B vises kun hvis felt A har bestemt værdi)
- UI ændres uden varsel, ingen versioneret API for de fleste formularer
- Begge platforme kan detektere robotagtig adfærd og smide re-auth/challenges ind

**Forudsætning for v1:** 2FA/login er allerede håndteret manuelt eller via separat session-injection — StoreForm overtager først *efter* vi er logget ind på korrekt konto. Session-håndtering (cookie/storage state) er ud af scope for v1 (se F002-epic), men skal designes så det kan tilføjes.

## 2. Mål for v1

- Generisk, schema-drevet formular-udfyldningsmotor (ikke hardcoded per formular)
- Selvhelende locator-strategi i lag, så små DOM-ændringer ikke brækker kørsler — leveret via cloud Lens
- Checkpoint/resume per step (samme mønster som Buddy F68 post-compact resume)
- Drift-detection via Lens, så ændringer opdages *før* en rigtig kørsel fejler
- Graceful fail — pause og notifikér, aldrig gæt og indsend forkert data
- Scope: 2 konkrete formularer som proof-of-concept (se §3)

## 3. Scope for v1 — to konkrete formularer

| Platform | Formular | Hvorfor først |
|---|---|---|
| App Store Connect | App-version submission (metadata + screenshots + \"send til review\") | Velkendt, gentages ved hver release |
| Google Play Console | Data safety / release-formular | Komplekst, multi-step, høj fejlrate manuelt |

Begge har Christian allerede konkret erfaring med at udfylde manuelt — godt grundlag for at validere schemaerne mod virkeligheden. **Bemærk:** v1 stopper FØR det faktiske \"send til review\"/publish-step (den irreversible handling); auto-submit er F002-scope.

## 4. Arkitektur

### 4.0 Ansvarsdeling: StoreForm vs. cloud Lens (VIGTIG)
Browseren drives af **cloud Lens** — cardmem's hostede browser-motor. StoreForm ejer IKKE en egen Playwright/Chromium. Ansvarsdeling:

| StoreForm ejer | Cloud Lens ejer (eller: gap vi filer til cardmem) |
|---|---|
| Schema-format (deklarativ formular-definition) | At navigere til ekstern autentificeret URL |
| Step-runner / orkestrering (rækkefølge, betingelser) | Lagdelt locator (role → tekst → vision-fallback) |
| Checkpoint/resume-state (bun:sqlite) | Udfyldning af felt via locator-resultat |
| Graceful-fail-flow + Cardmem-\"needs review\"-story | Human-like pacing (delays, mouse-movement) |
| Drift-detection-wiring (kalder Lens) | Screenshot + pixel-diff (Lens har det) |
| Telemetri til Upmetrics (\"degraded match\") | Genbrug af forud-indlogget session |

> **F112:** Repoets HARD RULE (aldrig rå Playwright, altid Lens) gælder StoreForm **fuldt ud** — ikke kun cc's verifikation. Tidligere udkast antog en privat Playwright-motor; det er omgjort. Mangler cloud Lens en af capabilities ovenfor → **file gap til cardmem** (story F001.10), byg det INTO Lens, og consumer det. Aldrig en one-off Playwright-workaround.

### 4.1 Lagdelt locator-strategi (leveret af Lens)
Pr. felt, i rækkefølge — StoreForm angiver locator-kandidaterne i schemaet, Lens eksekverer dem:
1. **Role-baseret** (mest robust, semantisk)
2. **Synlig tekst** (fuzzy match)
3. **Vision-fallback** — screenshot + accessibility-tree → model (via Lens' egen model-adgang, ellers `@broberg/ai-sdk`) → koordinater/element-reference

Når lag 1–2 fejler men lag 3 redder kørslen, logger StoreForm en \"degraded match\" til Upmetrics — signal om at schemaet trænger til opdatering.

### 4.2 Schema-drevet formular-definition
Hvert formular-step beskrives deklarativt (YAML/JSON), ikke som kode:

```yaml
form: app-store-connect/version-submission
steps:
  - id: whats-new
    fields:
      - name: release_notes
        type: textarea
        locators:
          - role: { name: \"What's New in This Version\" }
          - text: \"What's New\"
    on_success: next
```

Motoren er generisk og driver Lens imod schemaet. Når Apple/Google ændrer DOM, retter man schemaet — ikke koden.

### 4.3 Checkpoint/resume
Hvert step gemmer state (udfyldte felter, værdier, screenshot som bevis) til `bun:sqlite` lokalt (Upmetrics som telemetri-sink). Et fejlet run genoptages fra step N — samme mønster som Buddy's PreCompact/SessionStart hooks. Kræver per-step-hooks fra Lens (del af F001.10-gap-mappen).

### 4.4 Drift-detection (Lens)
Pre-run/natligt job der via Lens navigerer til formularen, capturer og kører pixel-diff mod godkendt baseline (`lens_verify`), og alarmerer via Buddycloud ved afvigelse > threshold. Fanger UI-ændringer *før* et rigtigt run rammer dem.

### 4.5 Graceful fail
Løber locator-kæden tør for et felt: StoreForm stopper runnet (Lens giver kontrol tilbage), gemmer state + screenshot, notificerer via Buddycloud, markerer schema-feltet \"needs review\" og opretter en Cardmem-story. Fejlagtig indsendelse til Apple/Google er ofte irreversibel — \"stop og spørg\" er altid billigere end \"gæt og fortsæt\".

### 4.6 Human-like pacing (Lens-capability)
Randomiserede delays + reel mouse-movement, leveret af Lens-driveren (ikke StoreForm-kode). StoreForm konfigurerer det; hvis cloud Lens ikke eksponerer det → gap til cardmem.

## 5. Stack

| Lag | Valg |
|---|---|
| Browser-automation | **Cloud Lens** (cardmem) — driver browseren; StoreForm kalder den |
| Runtime | Bun |
| Engine/CLI | Én Bun-pakke (Hono kun hvis monitoring-web-UI ønskes senere — F002) |
| Model-kald (hvor StoreForm selv kalder) | `@broberg/ai-sdk` (billigste egnede tier) — aldrig rå provider-SDK/Anthropic |
| State/checkpoint | `bun:sqlite` lokalt, Upmetrics som telemetri-sink |
| Drift-detection | Lens (`lens_verify`, pixel-diff) |
| Notifikationer | Buddycloud |
| Projektstyring | Cardmem (denne epic + stories) |
| Hemmeligheder | `.env` via DotEnv, aldrig hardcoded |

## 6. Stories under denne epic

| Story | Fase | Indhold |
|---|---|---|
| **F001.1** | setup | Repo-enrollment: Upmetrics (DSN + `uk_`) + Discovery-adoption |
| **F001.10** | setup | **Cloud Lens capability-map + gap-filing** — kortlæg hvad cloud Lens kan for ekstern form-automation, file gaps til cardmem, fastlæg StoreForm↔Lens-kontrakten. Blokerer motor-arbejdet. |
| **F001.2** | F1 | Schema-format & step-runner der DRIVER cloud Lens (lag 1–2) |
| **F001.3** | F2 | App Store Connect schema (PoC) via Lens |
| **F001.4** | F3 | Checkpoint/resume pr. step |
| **F001.5** | F4 | Vision-fallback (lag 3) — verificér via Lens; file gap hvis mangler |
| **F001.6** | F5 | Google Play Console schema (PoC) — validerer platform-agnostik |
| **F001.7** | F6 | Drift-detection via Lens + Buddycloud-alarm |
| **F001.8** | F7 | Graceful fail + auto-Cardmem-story ved \"needs review\" |
| **F001.9** | F8 | Human-like pacing (via Lens-config) & hardening (fulde E2E-runs) |

Afhængighed: F001.1 → F001.10 → F001.2 → … → F001.9 (lineær, følger planens faser). **Note:** F001.5 og F001.6 kunne teknisk parallelisere efter motor + ASC-schema; v1 følger den lineære orden for enkelhed.

## 7. Ud af scope for v1 — se epic F002

De deferrede features ligger nu som rigtige kort under **epic F002 (StoreForm v2 — deferred scope)**: login/2FA + session-injection, auto-submit (\"send til review\"/publish), scheduled/automatisk kørsel, visuel schema-editor, monitoring-web-UI (+ dens Lens data-testid-foundry), og pakke-split til `@storeform/*`. **Lens-foundry:** StoreForm har ingen EGEN interaktiv UI i v1 (CLI + motor; \"UI'et\" er Apples/Googles). Ingen data-testid-foundry nødvendig før et evt. monitoring-UI (F002).

## 8. §8 — Beslutninger (BEKRÆFTET af Christian 2026-07-03)

1. **Kode-struktur:** Én Bun-pakke nu; split til `@storeform/*` senere når en 2. consumer opstår (F002-story).
2. **Trigger:** Manuelt via CLI for v1; scheduled/automatisk er F002.
3. **Enrollment-timing:** Upmetrics + Discovery som setup-story (F001.1) FØR motoren. Cardmem allerede tilmeldt.

---

*Adopteret fra Christians spec-asset; revideret til Lens-driven arkitektur på Christians direktiv. Stories bærer eksplicitte, testbare acceptance criteria — se de enkelte kort.*
