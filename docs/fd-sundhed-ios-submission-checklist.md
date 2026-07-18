# FD Sundhed — iOS App Store submission checklist (manus til fd-sundhed)

**App:** FD Sundhed · **Apple ID:** `6792116588` · **Bundle:** `dk.fdsundhed` ·
**Status:** iOS 1.0 – Prepare for Submission · **Konto:** ARKADENS FYSIOTERAPI
(Morten Skjoldager) · **Build:** 31 uploadet (i aftes).

Leveret af StoreForm 2026-07-17. **fd-sundhed står selv for hele API-delen**
(fastlane `deliver`/`pilot` eller rå ASC API — samme som I gjorde for FD Sport).
StoreForm har lavet den ene kun-UI-brik (App Privacy). Resten er API.

## Status-legende
- ✅ **Done** (StoreForm)
- 🔷 **fd-sundhed via ASC API** (fastlane/deliver) — bulk-arbejdet, ingen browser
- 📝 **Input I skal samle** (tekster/assets/beslutning)
- 🖥️ **Kun-UI** (browser) — StoreForm-territorie hvis det bliver nødvendigt
- 🔒 **Gated på Christians eksplicitte go**

## POSITIONERING (gælder ALT tekst/metadata — hard constraint fra Christian)
FD Sundhed skal fremstå som en **general-purpose sundhedsforsikrings-app**.
**Intet om Aalborg Kommune** nogen steder i metadata, beskrivelse, keywords,
screenshots — ellers kræver Apple lukket Enterprise/Custom-distribution.
Reviewer-blocker: onboarding-teksten "Som ansat i Aalborg Kommune" skal fjernes
før review (jeres kort mockup-023450ed / MOCKUP-KONFORMITET.md).

## 1. Agreements / Tax / Banking (Business)
- 🖥️ **StoreForm (mig) — UI-only, IKKE fd-sundhed.** Bekræft/accepter
  **gratis-app-aftalen** i Business (kun-UI, intet API). Paid Applications-aftalen
  blev accepteret ifm. app-record-oprettelsen; for en gratis app er gratis-aftalen
  nok. Jeg driver det på Christians go (legal-accept kræver hans go, som Paid Apps).

## 2. App Information (General → App Information)
- ✅ Navn: "FD Sundhed" (sat ved oprettelse)
- 📝🔷 **Subtitle** (max 30 tegn, ingen Aalborg)
- 📝🔷 **Kategori** primær/sekundær (Health & Fitness eller Medical — jeres valg;
  Health & Fitness passer en forsikrings-/sundhedsapp bredest)
- 🔷 **Content Rights** (indeholder appen 3.-parts-indhold: normalt "nej")
- ✅ **Privacy Policy URL**: `https://sundhed.fdaalborg.dk/privacy` (sat via App Privacy)

## 3. Pricing and Availability
- 🔷 **Pris:** Gratis
- 📝🔷 **Tilgængelighed** (territorier — kun Danmark, eller bredere? beslutning)

## 4. Version 1.0 metadata (Prepare for Submission)
- 📝🔷 **Beskrivelse** (ingen Aalborg Kommune)
- 📝🔷 **Keywords** (100 tegn, komma-separeret, ingen Aalborg)
- 📝🔷 **Promotional Text** (valgfri, 170 tegn)
- 📝🔷 **Support URL** (fx `https://sundhed.fdaalborg.dk/support`)
- 📝🔷 **Marketing URL** (valgfri)
- 📝🔷 **Screenshots** (påkrævet: 6.7"/6.9" iPhone; 6.5" hvis I understøtter;
  iPad hvis universal). Upload via API. **Må ikke vise Aalborg Kommune.**
- 📝🔷 **App Preview-videoer** (valgfri)
- 📝🔷 **Copyright** (fx "© 2026 Arkadens Fysioterapi")
- 🔷 **Vælg build:** knyt **Build 31** til version 1.0
- N/A "What's New" (kun ved opdateringer, ikke 1.0)

## 5. App Review Information
- 📝 **Demo-konto** (username + password) — reviewer SKAL kunne logge ind.
  ⚠️ Demo-kontoens onboarding må IKKE vise "Som ansat i Aalborg Kommune".
- 📝 **Kontaktinfo** (navn, email, telefon)
- 📝 **Notes** til reviewer (fx forklar at det er en sundhedsforsikrings-app,
  hvordan demo-login virker)

## 6. App Privacy ✅ DONE (StoreForm)
Udfyldt + gemt som **kladde** i ASC (Apple ID 6792116588). Verificeret med
screenshots. **Ikke publiceret** — 🔒 afventer Christians go / jeres første version.
- Privacy Policy URL: `https://sundhed.fdaalborg.dk/privacy`
- 9 datatyper, alle formål = **App Functionality**, **ingen tracking**, ingen ads:
  - Linked til identitet: Name, Email Address, Phone Number, Health,
    Photos or Videos, User ID, Device ID, **Other Data Types** (CPR — krypteret,
    kun til bookingsystemet)
  - IKKE linked: **Crash Data** (Diagnostics, ingen bruger-id på events)
- Reproducérbar: `schemas/app-store-connect.app-privacy.yaml` (StoreForm-repo).
  Når I skal **Publish** App Privacy: gøres sammen med version-submit (Apple
  frigiver labelen med næste version).

## 7. Export Compliance (kryptering)
- 🔷 Deklarér: sæt `ITSAppUsesNonExemptEncryption` i Info.plist (typisk `false`
  hvis kun standard HTTPS/kryptering), eller besvar i ASC. Undgår review-prompt.

## 8. Age Rating
- 🔷 **Aldersvurdering-spørgeskema** (ASC API understøtter `ageRatingDeclaration`).
  En sundhedsapp: besvar ærligt (typisk 4+/12+ afhængig af medicinsk info).

## 9. Submit for Review
- 🔒 **Gated på Christians eksplicitte go.** StoreForm/StoreForm-flowet
  auto-submitter ALDRIG (v1 stopper før submit). Kræver også at App Privacy
  Publish sker, og at Aalborg-teksten er fjernet.

---
### Rækkefølge-forslag
1. Fix Aalborg-tekst i onboarding (blocker for review).
2. API: App Info + kategori + pris + territorier + export compliance + age rating.
3. API: version-metadata + screenshots + knyt Build 31.
4. Demo-konto + App Review-info.
5. Christians go → App Privacy Publish + Submit for Review.
