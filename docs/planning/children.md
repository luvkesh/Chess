# Children first: safety, privacy and store readiness

Chacklate Chess is directed to children as its main audience (Unity Cloud project "Chess" is set to
"directed to children" for COPPA). This page records what that means for the product, what is built,
and what is left before launch. It is an engineering summary, not legal advice: a lawyer familiar
with COPPA and India's DPDP Act should review it before public launch.

## Rules we design to

| Rule | Who it covers | What it asks for |
| --- | --- | --- |
| US COPPA (16 CFR 312, 2025 amendments) | Under 13 | Verifiable parental consent before collecting personal data; data minimisation; parent can review and delete; written retention policy; no behavioural ads |
| India DPDP Act 2023 and DPDP Rules 2025 (s. 9) | Under 18 | Verifiable consent of a parent; no tracking, behavioural monitoring or targeted ads to children; grievance officer; erasure on request |
| UK Age Appropriate Design Code | Under 18 | High privacy by default, no nudges to weaken privacy, no detrimental use of data |
| Apple App Store Kids category (guideline 1.3, 5.1.4) | Kids apps | Parental gate before purchases and outbound links; no third-party analytics or ads; no data sent to third parties |
| Google Play Families policy | Apps for children | Families Self-Certified Ads SDKs only (we use none); no precise location; appropriate content; Teacher Approved is optional |

## How the game works now

**Ages.** Sign-up asks for birth month and year with a neutral picker (no "you must be 13" hint).
Bands: child (under 13), teen (13 to 17), adult (18+). Accounts made before ages existed count as
minors until an age is given. Code: `services/game-server/src/family.js`.

**Offline without anything.** Games against the computer, lessons, puzzles and the dojo run on the
device and send nothing. A guest can play the kids pool online without an account; guests share
no personal data.

**Parental consent.** An under-18 gives a parent's email. We email a 7-day, single-use link to the
[parent page](../../apps/parent/index.html) (`/parent`). The parent reads what we keep, picks
controls, ticks "I am the parent or guardian", and creates a parent account (email, password,
purchase PIN). Until then the child's account cannot play online, sync progress, get reminders or
buy anything. This is the "email plus" style of consent; for higher assurance before launch we
can add a small card check through the payment provider (COPPA's "monetary transaction" method).

**Parent controls.** Online play, rated games, teen access to the adult pool, reminders, purchases
(PIN or off) and a daily time limit. Changes apply on the child's device at once. The parent page
also shows activity, downloads all of a child's data as JSON, deletes a child's account, and
withdraws consent (deleting everything).

**Names.** Under-18s choose from generated names (Adjective + Animal + number). Adults' typed names
are checked for English and Hindi slurs (with leetspeak folding) and for contact details.

**Who meets whom.** Two matchmaking pools: `kids` (minors and guests) and `open` (adults, plus
teens whose parent allows it). Friend codes work only within the same pool. There is no chat of any
kind. Under-18s have no public profile and are not on leaderboards.

**Purchases.** A parent gate (a multiplication written in words) sits in front of the store, every
purchase and turning on reminders, for every player, as Apple requires. Under-18 purchases also
need the parent's PIN on the server; five wrong PINs lock purchases for 15 minutes.

**No manipulative design.**
- No loot boxes or paid random rewards; everything for sale is shown exactly.
- No countdowns: seasons show an end date, not "3 days left".
- Reminders are off by default for minors, need a parent's yes, and never say "you'll lose your
  streak" or mention deadlines.
- A streak forgives one missed day a week.
- Season rewards a player has earned stay theirs after the season ends.
- No ads, no third-party analytics, no tracking SDKs anywhere.

**Voices.** Coach voices are pre-recorded files (Kokoro-82M, Apache-2.0). Nothing a child says or
types goes anywhere; the app never uses the microphone.

## Store checklists

### Apple Kids category
- [x] Parental gate before purchases, the store and settings that reach outside the app
- [x] No third-party analytics or advertising
- [x] No data to third parties beyond service providers needed to run the game
- [x] Privacy policy URL (`/privacy`)
- [ ] Age band choice in App Store Connect (5 and under, 6 to 8, 9 to 11): recommend 9 to 11
- [ ] App Privacy "nutrition label": Data Linked to You = User ID, Gameplay Content, Purchases; no tracking
- [ ] Unity build: check that Unity Analytics and any Unity Ads packages are removed (the project
      setting "directed to children" disables Unity's own data collection)

### Google Play Families
- [x] Target audience includes under 13; no ads SDKs
- [x] No precise location, no device identifiers sent
- [x] Privacy policy URL
- [ ] Data safety form: same answers as Apple's label
- [ ] Families Policy declaration in Play Console; content rating questionnaire (IARC)

## Left before launch

- Operator details in the privacy policy: company name and address, privacy email, grievance
  officer, and the names of the hosting, email and payment providers.
- A lawyer's review of the consent flow and the policy text.
- Decide on a higher-assurance consent method for under-13s in the US (card check).
- Retention: automatic deletion of accounts unused for 24 months (not built yet).
- Admin console: show age band and consent status to moderators.
