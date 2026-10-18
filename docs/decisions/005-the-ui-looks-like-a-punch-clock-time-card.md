# 5. The UI looks like a punch-clock time card

- date: 2026-10-18
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

The interface is dressed as a punch-clock time card, recorded in `DESIGN.md` and held
as Tailwind theme values in `src/routes/layout.css`: blue card stock as the ground,
blue-black card ink for text and hairline rules, a card-ink rail as the shell (a top
bar and bottom navigation on the phone, a left rail on the PC), ribbon violet only for
what is live or the one primary action, and ribbon red only for what is irregular or
destructive. Archivo is the one UI face, its condensed capitals for column heads;
times, dates and durations are set in condensed Martian Mono. Both fonts are
self-hosted. Light is the default and dark follows the device setting. Controls stay
the standard web ones; the world lends type, palette, density and the punched-time
signature, never the layout or the controls.

## Why

The product is intervals punched in and out and a record where nothing is lost; a
time card already carries that in its fixed IN and OUT columns, Monday-first rows and
red irregular punches, so the screens of phases 4 to 6 get a state vocabulary (live,
irregular, settled, struck) without inventing one. It was the direction assigned by
impeccable's seeded roll over seven candidates; the six catalog challengers lost on
audience identification and product clarity, and the call was made in the operator's
place, who delegated the design to impeccable.
