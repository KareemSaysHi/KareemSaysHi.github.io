# 3-Style Corner Trainer

A pure-frontend trainer for Speffz 3BLD corner 3-style, using **C as the buffer sticker** (UFR buffer piece, so C/J/M are excluded as targets).

## Run it

No install or build step is required.

1. Unzip the folder.
2. Open `index.html` in a modern browser.

Your data is stored in that browser's `localStorage`.

## Features

- All **189 valid unordered corner target pairs** are generated automatically.
- Reverse directions are grouped as one case, e.g. `BP / PB`.
- Categories have user-selectable colors, shown in the organizer, trainer, and stats.
- Each case can have:
  - one category
  - any number of tags
  - freeform notes
  - a successful review count
- Train one or more categories (plus uncategorized if desired).
- Optionally restrict a session to cases containing one Speffz target letter.
- Each card forces both directions before grading, then shows both together (for example `BP / PB`) on the grading screen.
- `Good`:
  - increments the review count
  - removes that case from the current session
- `Try again`:
  - does not increment the review count
  - reinserts the case 2–4 cards later when possible
- Stats by category and by individual case.
- JSON import/export for backups.
- Mobile-friendly responsive layout.

## Speffz model

Corner pieces are encoded as:

- A/E/R
- B/N/Q
- C/J/M — buffer piece, excluded
- D/F/I
- G/L/U
- H/S/X
- K/P/V
- O/T/W

Pairs using two stickers from the same physical target corner are excluded.

- Categories display normally with an Edit button; name/color fields only appear while editing.

- Reset individual or all successful review counts from the Stats page without touching categories, tags, colors, or notes.
