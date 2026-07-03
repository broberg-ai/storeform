# Extreme Test Form — fixture + element-taxonomi

`index.html` er StoreForms hårde test-fixture: en self-contained "kitchen-sink"
der dækker hver interaktiv HTML-elementtype + mønster motoren skal kunne
genkende og udfylde. Godkendt af Christian 2026-07-03 (promoveret fra cardmem
mockup `019f2920-027a-7536-849f-35f7d18be6ee`, kort F001.11).

## To zoner

| Zone | Sektion | Anchors | Formål |
|---|---|---|---|
| **A — happy-path** | 1–8 | Hvert interaktivt element har et rent, semantisk `data-testid` | Dagens pipeline (F001.2): Lens rammer via `{testid}` |
| **B — self-heal-gauntlet** | 9 | Bevidst UDEN stabile anchors — kun ARIA role/label, kun synlig tekst, eller kun vision-findbar | Beviser Lens' G1 self-heal (role→label→text→vision) |

## Coverage — hvad fixturen dækker

Knapper (submit/reset/primary/danger/ghost/link-as-button/icon/split/toggle/disabled/loading) ·
tekst (text/email/url/tel/password/number/search/textarea/masked/datalist/floating-label/contenteditable) ·
checkbox (enkelt/gruppe/indeterminate/switch) · radio (gruppe/segmented/card) ·
select (native single/multi) · custom combobox · async lookup/typeahead · cascading dropdowns · tag-multiselect ·
dato/tid (date/time/datetime-local/month/week + custom kalender-popover) · range · color ·
file (enkelt/multi/drag-drop) · modaler (`<dialog>`/custom/confirm/multi-step wizard m. branching/nested/drawer/popover/tooltip/toast) ·
tabs · accordion · betinget felt · forsinket render.
**Automation-hårde cases:** shadow DOM, iframe-felt, placeholder-only, genereret-ustabil-class, visually-hidden-men-fokuserbart.

## Zone B → Lens LocateSpec (F215.7/.8)

Hvert gauntlet-felt er mærket med det lag der forventes at ramme det. Sådan targetter et StoreForm-schema dem via Lens' `/flow` `target` (LocateSpec):

| Felt-mærke | Lens LocateSpec | `resolved_via` |
|---|---|---|
| 🔵 **ROLE** | `{role:'…', name:'…'}` eller `{label:'…'}` | `role` / `label` |
| 🟣 **TEXT** | `{text:'…'}` (evt. `{placeholder:'…'}`) | `text` / `placeholder` |
| 🔴 **VISION** | `{vision:'<beskrivelse>'}` (aktiv F215.8, Set-of-Marks) | `vision` |

Alt der resolver UNDER `testid` = "degraded match" → logges til Upmetrics (planens §4.1);
`vision` er det stærkeste degraded-signal (schema-felt trænger til en bedre role/label/text-nøgle).

> Fixturen er IKKE produkt-UI — Zone B's manglende `data-testid` er bevidst design
> (self-heal-gauntlet). Native controls medtages fordi motoren skal kunne genkende
> dem i virkelige ASC/Play-formularer, ikke som produkt-UI-anbefaling.
