# StoreForm

**Selvhelende, schema-drevet formular-automation for App Store Connect & Google Play Console.**

StoreForm læser en deklarativ opskrift (et *schema*) og udfylder release-/submission-formularer
automatisk — og *selvheler* når platformene ændrer deres DOM. I stedet for at rette kode når Apple
eller Google omdøber et felt, retter man schemaet.

> Status: v1 proof-of-concept. Motoren + de gated-fri dele er bygget og testet; de rigtige
> platform-kørsler venter på et indlogget App Store Connect / Google Play-login (håndteres uden
> for v1). Se `docs/features/F001-storeform-v1.md` for fuld plan + story-status.

## Sådan virker det

StoreForm ejer **ikke** en browser. Den driver **Cardmem Lens** (cardmems browser-motor) — aldrig
rå Playwright (repo-reglen F112). To flader, samme grammatik:

| Flade | Hvornår | Hvordan |
|---|---|---|
| **Lokal daemon** (`127.0.0.1:7475/lens`) | Device/IP-bundne 2FA-sites (App Store Connect, Google Play) | `--daemon` — kører på din maskine, samme IP som dit login, så Apple/Google accepterer sessionen |
| **Cloud Lens** (`lens.cardmem.com`) | IP-agnostiske mål | default — token via `LENS_CLOUD_TOKEN` |

Begge konsumeres via `@broberg/lens-client` (reuse-first, aldrig rå `fetch`).

### Selvhelende locators (lag)
Hvert felt angiver locator-*kandidater* i lag; Lens prøver dem i fast rækkefølge og rapporterer
hvilket lag der ramte (`resolved_via`):

```
testid → css → role → label → placeholder → text → vision
```

Rammer et lag under det du deklarerede som bedst (fx du angav en `testid` men den er væk, og `role`
redder felten), logges en **degraded match** til Upmetrics — et signal om at schemaet trænger til en
bedre nøgle. Apple/Google har ingen stabile `data-testid`, så `role`/`label`/`text` ER strategien.

## Schema-format (YAML/JSON)

```yaml
form: app-store-connect/version-submission
mutates: true
pacing: { min_ms: 400, max_ms: 1200 }   # valgfri human-like pacing (F001.9)
steps:
  - id: prepare-submission
    fields:
      - name: whats-new
        action: fill                       # fill | type | select | click | upload | expectVisible | expectText
        locator: { label: "What's New in This Version", role: textbox, text: "What's New" }
        value: "{{ whats_new }}"           # {{ key }} udfyldes fra --data ved kørsel
      - name: submit-button-present
        action: expectVisible              # v1 STOPPER før det faktiske "Send til review"
        locator: { role: button, text: "Add for Review" }
```

Locator-nøgler: `{ testid?, css?, role?, name?, label?, placeholder?, text?, exact?, nth?, vision? }`.
Eksempel-schemaer i `schemas/` (ASC + Google Play + fixturens Zone A/B).

## CLI

```bash
bun run src/run.ts <schema.yaml> \
  [--daemon] \                       # kør mod den lokale daemon (same-IP, til ASC/Play)
  [--base-url <url>] \               # target-URL (overstyrer schema.base_url)
  [--state storageState.json] \      # forud-indlogget session (login/2FA er uden for v1)
  [--data key=value]... \            # udfylder {{ key }} i schemaet
  [--resume] \                       # genoptag en afbrudt kørsel fra første ufuldførte felt
  [--dry]                            # print den oversatte FlowRequest uden at kalde Lens
```

- **Checkpoint/resume (F001.4):** hvert felts udfald persisteres til `bun:sqlite`; `--resume`
  fortsætter fra det første ufuldførte felt og gen-indsender **aldrig** et fuldført felt.
- **Graceful fail (F001.8):** løber locator-kæden tør → kørslen **STOPPER** (gætter aldrig, indsender
  aldrig), gemmer en `needs-review`-rapport + screenshot, og opretter et item i projektets cardmem
  Inbox (ship-dark uden `STOREFORM_CARDMEM_INBOX_*`).
- **Pacing (F001.9):** `pacing`-blokken i schemaet giver randomiserede delays mellem felter.

## Opsætning

```bash
bun install
cp .env.example .env      # udfyld secrets (aldrig committet — .env er gitignored)
bun test                  # kør test-suiten
bunx tsc --noEmit         # typecheck
```

Secrets (alle valgfri; hver funktion ship-dark uden sin nøgle): `UPMETRICS_DSN` (fejl-tracking),
`LENS_CLOUD_TOKEN` (sky-Lens), `STOREFORM_CARDMEM_INBOX_*` (graceful-fail needs-review), `DISCOVERY_ENROLL_KEY`.

## Stack

Bun · `@broberg/lens-client` (browser-driving) · `bun:sqlite` (checkpoint-state) · `zod` (schema) ·
`yaml` · `@upmetrics/sdk` (telemetri). Én pakke i v1; split til `@storeform/*` er deferred (F002).

## Ud af scope for v1 (→ epic F002)

Login/2FA-injection, auto-submit (den irreversible "send til review"/publish), scheduled kørsel,
visuel schema-editor, monitoring-web-UI. v1 stopper altid **før** det faktiske indsend.
