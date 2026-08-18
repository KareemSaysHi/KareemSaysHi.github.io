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
  - one category, with a color and long description
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


## v7 changes

- Organizer search now searches **letter pairs only**; notes are not included in search.
- Navigation tabs and organizer filters are no longer sticky. The entire page scrolls normally.


## v8 changes

- Categories can be reordered with Up/Down controls. The stored category array order is used throughout the app.
- Changing a letter pair's category immediately updates that case card's colored border.


## v9 changes

- The Train page now supports selecting any subset of target letters.
- A case is included if it contains at least one selected letter.
- With no letters selected, letter filtering is disabled.
- Includes Select all / Clear controls for the letter set.


## v10 changes

- Category descriptions are no longer displayed inside the category manager items.
- Selecting a specific category in the Organizer's Category dropdown reveals that category's description below the filters.
- The description is directly editable there and auto-saves as you type.
- "All" and "Uncategorized" do not show a description editor.


## v11 changes

- Removed the category reordering arrows and related controls.
- Categories stay in their existing order, keeping the category manager cleaner.


## v12 changes

- Fixed malformed category-layout CSS from an earlier update.
- Category color swatches are now true circles with fixed width/height and cannot be squished by flex layout.


## v13 changes

- While training a direction, pressing **Space** performs the same action as "I did this direction".
- Space does nothing on the Good / Try Again grading screen.
- The shortcut prevents normal page scrolling while it is active.


## v14 changes

- Added a new **Map** page.
- The Map page shows a non-interactive matrix of all unordered target pairs.
- Valid categorized pairs are colored with their category color.
- Valid uncategorized pairs are white.
- Lower-triangle cells, diagonal cells, and same-piece combinations are shown as blocked dark cells.


## v15 changes

- After completing both directions of a training card, the grading screen now includes a notes editor.
- Notes auto-save as you type.
- Training notes use the same per-pair notes field as the Organizer page.
- Existing notes are prefilled, so they can be edited during study.


## v16 changes

- Category ordering is back, now with drag-and-drop instead of arrow buttons.
- Categories appear as a clean vertical list with a subtle drag handle.
- Dragging works with mouse, pen, and touch via Pointer Events.
- The new order is saved immediately and is reflected throughout the app and JSON export.
