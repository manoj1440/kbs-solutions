# F-820 Mobile redesign — clear, current, one obvious next step

Status: DONE (2026-11-12, session 26, owner request: "the OTP screen and the whole app look old and not intuitive — analyse, plan, redesign, implement"; design decisions delegated to engineering).
Supersedes the look of F-805 / F-818 (glass theme). ADR-003 still holds: in-house RN primitives, tokens, no UI kit.

## 1. Analysis — why the app reads as dated (40 screens photographed, session 25)
| # | Finding | Where |
|---|---|---|
| A1 | **Foggy canvas.** A sage → peach ambient wash plus frosted panels sits behind every screen; content never stands out and every screen looks the same | all screens (`GlassScope`, `Glass`) |
| A2 | **Boxes inside boxes.** Thin-bordered white cards hold more bordered tiles (bank status trio, KPI grids, outcome rows) — spreadsheet feel | lead, earnings, homes, call desk |
| A3 | **Small, flat type.** Most text 12–15 px at weights 400/500; titles 17–22; the number that matters is not the biggest thing | everywhere |
| A4 | **Small controls.** 48 px fields/buttons, 10 px radius, thin grey outline, greyed-out disabled state | forms, sign-in |
| A5 | **OTP is not a 2026 OTP.** Small beige cells, a separate Verify tap after the last digit, the resend state reads as body text | `(auth)/otp` |
| A6 | **No single "do this next".** Primary buttons are black on some screens and orange on others; homes show 4–8 equal tiles with no focal figure; quick actions are tiny icon buttons | homes, sign-in, welcome |
| A7 | **Tab bar** is a floating frosted pill with 12 px labels — unusual shape, small targets | role tab layouts |
| A8 | Typeface is the default Inter that nobody chose | all |

## 2. Direction
- **Product.** A field-sales tool for KBS credit-card agents: see what to do next, log it in seconds, know what you have earned.
- **Character.** Confident, quick, plain-spoken.
- **World.** A bank card and a passbook: crisp white paper, dark ink, one card-orange.
- **Moments.** (1) One dark "ink" hero card per home screen carrying the figure that matters for that role. (2) The rendered credit card.
- **Signature.** The small source tag (dot + "Bank MIS" / "KBS") — unchanged, required by REQ-20.

## 3. System (tokens + shared components — carries to every screen)
| Area | Before | After |
|---|---|---|
| Canvas | cream + ambient gradient + blur | flat neutral `#F4F3F1`; no gradient, no blur (`GlassScope` paints nothing, `Glass` is a solid white surface) |
| Surfaces | white card + 1 px border + shadow | white card, **no border, no shadow**, radius 20; grouping inside a card by a `raised` fill, not an outline; hairlines only between list rows |
| Type | Inter 400/500; 12·13·14·15·17·22·28·32 | **Manrope** 500 body / 600 labels+titles / 700–800 emphasis (the existing `font-normal|medium|semibold|bold` classes map one step heavier); 12·13·14·16·18·24·30·38 |
| Radius | 6·8·10·12·16·20 | 8·10·14·18·22·28 (controls 14, cards 18–22, sheets 28) |
| Primary action | black or orange | **orange `#C2410C` everywhere** (white text 5.2:1); secondary = white with hairline; quiet = text. Disabled = flat neutral, not a faded copy |
| Controls | 48 px, outlined | **56 px**; white field with a 1.5 px outline that turns ink on focus; buttons 56 px in forms / footers (44 px small) |
| Header | compact row (session 25) | same row; back = plain chevron in a 40 px white circle; title 18/600 |
| Tab bar | floating glass pill | full-width white bar, hairline top, 64 px + inset, 24 px icons, 12 px labels, active = orange; centre action = 48 px orange circle |
| Badges | dot + outline pill | soft filled pill, no outline |

## 4. Screens
- **OTP.** Title "Enter the code", "Sent to +91 98••• 0011 · Change". Six 48×60 cells, 24 px digits, active cell ringed; **verifies automatically on the sixth digit** (button stays for accessibility and retry); wrong code shakes nothing — cells turn red and clear. Resend: quiet line with the live countdown, becomes an orange text button at zero.
- **Sign-in / sign-up.** Title + one line; one 56 px field with `+91`; orange "Send code" directly under it.
- **Welcome.** Same five slides (content kept); art and copy unchanged; orange CTA; larger dots.
- **Homes.** One ink hero card: Advisor = total earnings + "N to claim" + Request payout; Manager = team calling today (four dark tiles); Telecaller = follow-ups due now + Call back now. Advisor quick actions are four 56 px white tiles. KPI tiles lose borders.
- **Lists / detail.** Borderless cards on the canvas; bank status trio as three filled cells; tabs (`Segmented`) as a filled track.

## 5. Not changing
Content, order of sections, flows and API; the REQ-20 provenance tags; screen protection; the web.

## 6. Checks
Mobile typecheck / lint / unit; all Maestro flows on the rebuilt APK; before/after screenshot sheets of all 40 screens.

## Progress notes
- **2026-11-12 (session 26) — done.** System layer: `tailwind.config.js`, `lib/theme.ts`, `components/ui/glass.tsx` (no blur, flat canvas), `components/ui/index.tsx` (Button, Input, Card, Badge, Chip, Segmented, ChoiceRow, IconButton, new `HeroCard`), `components/tab-bar.tsx` (full-width bar), Manrope loaded in `app/_layout.tsx`. Screens: `AuthShell`, `(auth)/otp` (auto-verify on the sixth digit, larger cells, wrong code clears itself), `(auth)/mobile`, the three role homes (one ink hero card each), bank-status cells and hand-written cards (outlines removed). `Screen inset="none"` now masks the status bar so scrolled content does not slide under it. Manager Advisors list: the API note is a quiet line, not a boxed callout.
- **Checks.** Mobile typecheck, lint, unit (17) green. Release APK rebuilt (arm64, local API); all six Maestro flows pass on it (`otp-resend-wait`, `advisor-login`, `manager-approval`, `manager-advisors`, `advisor-onboarding-identity`, `poor-connectivity`) — flows updated for "Send code" and auto-verify. 40 screens photographed three times on a capture build and reviewed.
- **Not checked.** The status-bar mask and the Advisors-list note were added after the last photo round (covered by typecheck/lint and the Maestro run, not re-photographed). Not tried on a physical phone. Web is unchanged.
- **Left as is.** Content, section order, flows, REQ-20 source tags, screen protection. `Glass` / `GlassScope` / `HeroHeader` keep their names for call sites.
