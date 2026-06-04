# dxf-kit by the numbers 📐

> A fun snapshot of the project, measured at the `2026-06-02` release wave
> (`dxf-render@1.7.0` · `dxf-interaction@0.1.0` · `dxf-vuer@3.0.0` · `dxf-react@0.1.0` · `dxf-lit@0.1.1`).
> Numbers are approximate and counted from the repository at that point in time.

## Timeline

- **First commit:** 4 Dec 2025, 14:06
- **Latest commit:** 2 Jun 2026, 16:02
- **Age:** ~**180 days (6 months)** from the first line to shipping all five packages
- **The "holiday detox":** 21 commits in December → **zero in January** → back in February with 60. Someone took a real break and came back swinging 🎄

## Commits

- **364 commits** across **33 release tags**
- **One author** (a solo project — `Timur Arbaev`) 🧑‍💻
- **March madness:** **178 commits in March** alone — nearly half the entire history in one month 🔥
- **Record day:** 25 Feb — **26 commits** in a single day
- **Busiest weekday:** Thursday (73). Sundays were spared (23).
- **Night owl:** 31 commits at **00:00** — the third most active hour of the day 🦉

| Commit type | Count |
| ----------- | ----- |
| `feat:`     | 135   |
| `fix:`      | 116   |
| `docs:`     | 38    |
| `sys:`      | 22    |
| `refactor:` | 11    |
| `release:`  | 6     |
| other       | ~36   |

> 116 fixes against 135 features — classic for a parser fighting real-world "messy" DXF from a dozen different CAD editors. 😅

## Code

- **~55,300 lines** across `packages/` · **265 files** · 5 packages
- Breakdown by package:

| Package           | Lines  | Share |
| ----------------- | ------ | ----- |
| `dxf-render`      | 35,030 | 63%   |
| `dxf-vuer`        | 7,654  | 14%   |
| `dxf-lit`         | 5,749  | 10%   |
| `dxf-react`       | 3,449  | 6%    |
| `dxf-interaction` | 3,200  | 6%    |

- **Comments:** ~5,205 lines (~12% relative to code)
- **Biggest file:** `dxf-render/src/render/dimensions.ts` — **1,843 lines** (DIMENSION rendering, deservedly the most painful part of any CAD viewer) 🏆

## Tests

- **1,504 test cases** in **332** `describe` blocks across **76** test files
- **~20,145 lines of tests** — roughly **36% of the entire codebase**
- About **1 line of test per 1.7 lines** of non-test code 💪

## Domain facts

- **22** DXF entity types rendered · **33** public exports in the engine API
- Custom DXF parser built **from scratch** (zero external parser dependencies)
- Three.js `0.182`, crisp vector text via triangulated opentype.js glyphs
