# Trade Journal

A public, static trading research journal designed for GitHub Pages.

## Publish

This repository must be **public** for free GitHub Pages on a personal GitHub
account. In GitHub: **Settings → Pages → Deploy from a branch → `main` /
`(root)`**. The resulting journal URL will be:

`https://filatei.github.io/tradejournal/`

Do not publish broker logins, account numbers, personal P/L statements, or
unredacted trade exports.

## Add a journal entry

1. Copy `journal/entry-template.md` to `journal/YYYY-MM-DD-short-title.md`.
2. Fill in the observation, evidence and next test.
3. Add the entry to `journal/entries.json`.
4. Commit and push; GitHub Pages updates automatically.

## Backtesting

`tools/backtest_agg_pending.py` is a dependency-free research simulator for
the `AGG_PENDING_v9_17` BOTH + STOPS-ONLY grid configuration. It parses MT5
M1 exports and `.set` files, then writes comparable summaries.

```sh
python3 tools/backtest_agg_pending.py \
  --set ../MT5_SETUP/Experts/REPORTS/agg_pending_both_pendstop_good.set \
  --data-dir ../MT5_SETUP/Experts/DATA \
  --symbols US500.cash US100.cash US30.cash \
  --output reports/agg_pending_both_stops
```

The simulator is for research only. It cannot replace MT5 Strategy Tester:
broker contract values, commission, execution, swaps, and exact tick paths
still need MT5 confirmation.
