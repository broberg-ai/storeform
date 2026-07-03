# F001 — StoreForm v1
**Selvhelende formular-automation for App Store Connect & Google Play Console**

Status: Adopteret i cardmem (Branch B) · Draft v1
Ejer: Christian / WebHouse / Broberg AI
Kilde-plan: `@asset:019f28d5-5581-71e3-9494-668a5efc5c9f` (storeform-v1-plan.md, 2026-07-01)

> **Adoption-note (2026-07-03):** Denne plan blev skrevet af Christian som et løst spec-asset og adopteret ind i cardmem som epic F001 + 9 stories (F001.1–F001.9). Planens §8 (åbne spørgsmål) skulle afklares FØR nedbrydning. Christian var away-from-keyboard, så de tre §8-beslutninger er taget som **anbefalede defaults** (se §8 nedenfor) og kan omgøres ved review — kortene er redigerbare.

---

## 1. Problem

Manuel udfyldning af release-/submission-formularer i App Store Connect og Google Play Console er gentaget, fejlfølsomt arbejde. Almindelige Playwright record-and-replay scripts brækker konstant fordi:

- Begge platforme er bygget i React/Material med ustabile, genererede class-navne — ingen `data-testid` at holde fast i
- Multi-step wizards med betinget felt-logik (felt B vises kun hvis felt A har bestemt værdi)
- UI ændres uden varsel, ingen versioneret API for de fleste formularer
- Begge platforme kan detektere robotagtig adfærd og smide re-auth/challenges ind

**Forudsætning for v1:** 2FA/login er allerede håndteret manuelt eller via separat session-injection — StoreForm overtager først *efter* vi er logget ind på korrekt konto. Session-håndtering (cookie/storage state) er ud af scope for v1, men skal designes så det kan tilføjes i v2.

## 2. Mål for v1

- Generisk, schema-drevet formular-udfyldningsmotor (ikke hardcoded per formular)
- Selvhelende locator-strategi i lag, så små DOM-ændringer ikke brækker kørsler
- Checkpoint/resume per step (samme mønster som Buddy F68 post-compact resume)
- Drift-detection via Lens, så ændringer opdages *før* en rigtig kørsel fejler
- Graceful fail — pause og notifikér, aldrig gæt og indsend forkert data
- Scope: 2 konkrete formularer som proof-of-concept (se §3)

## 3. Scope for v1 — to konkrete formularer

| Platform | Formular | Hvorfor først |
|---|---|---|
| App Store Connect | App-version submission (metadata + screenshots + "send til review") | Velkendt, gentages ved hver release |
| Google Play Console | Data safety / release-formular | Komplekst, multi-step, høj fejlrate manuelt |

Begge har Christian allerede konkret erfaring med at udfylde manuelt — godt grundlag for at validere schemaerne mod virkeligheden.

## 4. Arkitektur

### 4.1 Lagdelt locator-strategi
Pr. felt forsøges i rækkefølge:
1. **Role-baseret** — Playwright `getByRole` / `getByLabel` (mest robust, semantisk)
2. **Synlig tekst** — `getByText` med fuzzy match
3. **Vision-fallback** — screenshot + accessibility tree sendes til model via `@broberg/ai-sdk` (billigste egnede tier), som returnerer koordinater/element-reference

Når lag 1–2 fejler, logges det til Upmetrics som "degraded match" — selvom kørslen lykkes, er det et signal om at schemaet trænger til opdatering.

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
          - role: { name: "What's New in This Version" }
          - text: "What's New"
    on_success: next
```

Selve motoren er generisk og kører imod schemaet. Når Apple/Google ændrer DOM, retter man schemaet — ikke koden.

### 4.3 Checkpoint/resume
Hvert step gemmer state (hvilke felter er udfyldt, hvilken værdi, screenshot som bevis) til `bun:sqlite` lokalt (Upmetrics som telemetri-sink). Et fejlet run kan genoptages fra step N i stedet for at starte forfra — samme mønster som Buddy's PreCompact/SessionStart hooks.

### 4.4 Drift-detection (genbrug Lens)
Natlig (eller pre-run) job der navigerer til formularen, tager screenshot, kører pixelmatch mod kendt baseline via Lens (`lens_verify`), og sender alarm via Buddycloud hvis afvigelse > threshold. Fanger UI-ændringer *før* et rigtigt run rammer dem.

### 4.5 Graceful fail
Når locator-kæden løber tør for et felt: stop runnet (ikke gæt), gem state + screenshot, notifikér via Buddycloud, marker schema-feltet som "needs review" i Cardmem. Fejlagtig indsendelse til Apple/Google er ofte irreversibel — derfor er "stop og spørg" altid billigere end "gæt og fortsæt".

### 4.6 Human-like pacing
Tilfældige delays mellem actions; reel mouse-movement (Playwright mouse API, ikke direkte `.click()`); undgår behavioral bot-detection på begge platforme.

> **Playwright vs. F112-reglen (vigtig afklaring):** Repoets CLAUDE.md har en HARD RULE (F112) om at cc-sessions ALDRIG må drive en browser med rå Playwright — kun via Cardmem Lens. Den regel gælder **cc's egen UI-verifikation** af vores surfaces. StoreForms lag 1–3 + pacing ER selve produktets runtime-motor, hvis hele formål er at drive Apples/Googles formularer — det er ikke en verifikations-workaround. **Drift-detection (§4.4 / F001.7) bruger korrekt Lens.** En fremtidig session må IKKE "rette" motoren til Lens-kald.

## 5. Stack

| Lag | Valg |
|---|---|
| Browser-automation | Playwright (produktets motor) |
| Runtime | Bun |
| Engine/CLI | Hono (kun hvis web-UI til monitoring ønskes senere) |
| Model-kald (vision fallback) | `@broberg/ai-sdk` → billigste egnede tier |
| State/checkpoint | `bun:sqlite` lokalt, Upmetrics som telemetri-sink |
| Drift-detection | Lens (`lens_verify`, pixelmatch) |
| Notifikationer | Buddycloud |
| Projektstyring | Cardmem (denne epic + stories) |
| Hemmeligheder | `.env` via DotEnv, aldrig hardcoded |

Ingen Anthropic API i selve stacken — kun `@broberg/ai-sdk`.

## 6. Faser → stories

Planens 8 faser (F1–F8) er adopteret som stories under denne epic, med en forudgående setup-story (§8-beslutning C):

| Story | Fase | Indhold |
|---|---|---|
| **F001.1** | (setup) | Repo-enrollment: Upmetrics (DSN + `uk_`) + Discovery-adoption af `@broberg/ai-sdk` |
| **F001.2** | F1 | Schema-format & engine-skelet (lag 1–2, ingen vision endnu) |
| **F001.3** | F2 | App Store Connect schema (PoC) mod rigtig test-session |
| **F001.4** | F3 | Checkpoint/resume pr. step |
| **F001.5** | F4 | Vision-fallback (lag 3 via `@broberg/ai-sdk`) |
| **F001.6** | F5 | Google Play Console schema (PoC) — validerer platform-agnostik |
| **F001.7** | F6 | Drift-detection via Lens + Buddycloud-alarm |
| **F001.8** | F7 | Graceful fail + auto-Cardmem-story ved "needs review" |
| **F001.9** | F8 | Human-like pacing & hardening (fulde E2E-runs) |

Afhængigheder er lineære (F001.1 → … → F001.9) og følger planens fase-rækkefølge. **Note:** F001.5 (vision) og F001.6 (Google-schema) kunne teknisk parallelisere når motoren + ASC-schemaet findes — men v1 følger den lineære orden for enkelhed.

## 7. Ud af scope for v1

- 2FA/login-automation (forudsætning, ikke del af v1)
- Session-injection/cookie-refresh (kandidat til v2)
- Flere end de to nævnte formularer
- Web-UI til at redigere schemaer visuelt (CLI/fil-redigering er nok til v1)
- **Lens-foundry / data-testid-epic:** StoreForm har ingen EGEN interaktiv UI i v1 (CLI + motor; "UI'et" er Apples/Googles, ikke vores). Ingen foundry-epic nødvendig nu. Tilføjes hvis et Hono monitoring-web-UI bygges senere.

## 8. §8 — Beslutninger (v1) — *taget som defaults mens Christian var away, kan omgøres*

Planens original-§8 var tre åbne spørgsmål. Afgjort som følger:

1. **Kode-struktur:** *Én Bun-pakke nu, split senere.* StoreForm ligger allerede i sit eget repo (så "modul i Buddy/Trail" er ude). Start med ÉN pakke — hurtigst til at validere de 2 formularer. Del op i `@storeform/engine` / `cli` / `schemas` når der reelt er brug for det (Rule 2: simplest der virker). *[Alternativ: pnpm monorepo fra start — vælg ved review hvis ønsket.]*
2. **Trigger:** *Manuelt via CLI for v1.* Kørsler startes af Christian fra terminal/cc mens de 2 formularer valideres. Scheduled/automatisk kørsel (Claude Code Remote routine) er en v2-udvidelse — matcher planens "når v1 er valideret". (Drift-check i F001.7 er stadig natlig/scheduled.)
3. **Enrollment-timing:** *Setup-story FØR F1.* Upmetrics tilmeldes i F001.1 før motoren bygges, så F1's "degraded match"-telemetri virker fra dag ét. Cardmem er allerede tilmeldt (denne adoption).

---

*Adopteret fra Christians spec-asset. Stories bærer eksplicitte, testbare acceptance criteria — se de enkelte kort.*
