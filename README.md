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

### Browser workspace (private drafts and imports)

The **Journal workspace** on the site lets you save manual entries in the
current browser. Drafts and saved entries use `localStorage`; use **Export
entries JSON** to make a portable backup. To promote an entry to this public
repository, copy its content into `journal/YYYY-MM-DD-short-title.md`, add a
summary to `journal/entries.json`, then commit and push yourself. The static
site cannot create files in this repository or commit to GitHub.

The same workspace can analyze an MT4/MT5 Account History CSV. The browser
reads and parses the selected file locally: it is not uploaded to GitHub,
this site, or any external service. Imported analysis exists only in the page
until it is refreshed; use **Export analysis JSON** to retain it. Clearing
site data or browser storage also removes local drafts and manual entries.

It supports comma-, tab-, and semicolon-separated exports and detects common
headers for ticket/order, times, symbol, type, lots, prices, commission, swap,
and profit. MT4 closed order history and MT5 deal history are handled on a
best-effort basis; balance/credit rows are ignored. Multiple MT5 deals can
belong to one position, so partial closes and broker-specific/non-standard
layouts need manual review or header mapping. This is a static viewer, not a
broker reconciliation system.

### Export Account History CSV

**MT4**

1. Open the **Terminal** window (`Ctrl+T`) and select the **Account History**
   tab.
2. Right-click inside the history, select a date range such as **Custom
   Period**, then right-click again.
3. Choose **Save as Detailed Report** or **Save as Report**. If your broker
   offers CSV directly, choose it; otherwise open the saved report in a
   spreadsheet and save its history table as CSV.
4. Remove account-identifying information before keeping or sharing the file,
   then select it in the Journal workspace.

**MT5**

1. Open **Toolbox** (`Ctrl+T`) and choose the **History** tab.
2. Right-click the history and select the desired period (for example,
   **Custom Period**).
3. Right-click again and choose **Report** / **Save as Report** (or
   **Export to XML/CSV** when your terminal provides that option).
4. Export the deals/orders table to CSV with headers, redact sensitive account
   fields, and select it in the Journal workspace.

### Repository entry workflow

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
