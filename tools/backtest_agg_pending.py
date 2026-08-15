#!/usr/bin/env python3
"""Research simulator for AGG_PENDING_v9_17 BOTH + PEND_STOPS_ONLY.

It validates ladder mechanics from MT5 M1 exports: buy stops above reference,
sell stops below, fills, basic TP exits, open-position cap and direction
switches. It intentionally does NOT model broker contract values, commission,
slippage, swaps, basket P/L percentages or exact tick order. Use MT5 Strategy
Tester before acting on any result.
"""
from __future__ import annotations

import argparse, csv, json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

@dataclass
class Bar:
    time: datetime; high: float; low: float; close: float

def value(text: str):
    raw = text.split("||", 1)[0].strip()
    if raw.lower() in ("true", "false"): return raw.lower() == "true"
    try: return float(raw) if "." in raw else int(raw)
    except ValueError: return raw

def read_set(path: Path) -> dict:
    payload = path.read_bytes()
    text = payload.decode("utf-16") if payload.startswith((b"\xff\xfe", b"\xfe\xff")) else payload.decode("utf-8")
    return {line.split("=", 1)[0]: value(line.split("=", 1)[1])
            for line in text.splitlines()
            if "=" in line and not line.lstrip().startswith(";")}

def read_bars(path: Path) -> list[Bar]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = csv.DictReader(f, delimiter="\t")
        out = []
        for r in rows:
            try:
                out.append(Bar(datetime.strptime(f"{r['<DATE>']} {r['<TIME>']}", "%Y.%m.%d %H:%M:%S"),
                               float(r["<HIGH>"]), float(r["<LOW>"]), float(r["<CLOSE>"])))
            except (KeyError, ValueError): pass
        return out

def simulate(symbol: str, bars: list[Bar], cfg: dict) -> dict:
    if not bars: return {}
    gap = bars[0].close * float(cfg.get("GridGapPercent", .2)) / 100
    ref = bars[0].close
    max_pos = int(cfg.get("MaxPositions", 20))
    max_pending = int(cfg.get("MaxPendingOrders", 10))
    depth = min(int(cfg.get("LadderDepthPerKind", 5)), max_pending)
    lot = float(cfg.get("LotSize", .1))
    multiplier = float(cfg.get("MartingaleMultiplier", 1.0))
    max_lot = float(cfg.get("MaxLotSize", 0))
    tp_pct = float(cfg.get("IndividualTPGapPercent", 0))
    buy_stops = [ref + gap * i for i in range(1, depth + 1)]
    sell_stops = [ref - gap * i for i in range(1, depth + 1)]
    positions, fills, exits, side_order, max_open = [], [], [], [], 0
    for bar in bars:
        # Conservative order when one M1 bar crosses both directions: trigger
        # the side closer to the bar close first; exact sequencing needs ticks.
        candidates = [(1, p, abs(p-bar.close)) for p in buy_stops if bar.high >= p]
        candidates += [(-1, p, abs(p-bar.close)) for p in sell_stops if bar.low <= p]
        for side, price, _ in sorted(candidates, key=lambda x: x[2]):
            if len(positions) >= max_pos: break
            ladder = buy_stops if side == 1 else sell_stops
            if price not in ladder: continue
            idx = ladder.index(price) + 1
            size = lot * (multiplier ** (idx - 1)) if cfg.get("MartingaleEnabled", False) else lot
            if max_lot: size = min(size, max_lot)
            positions.append({"side": side, "entry": price, "lot": size, "time": bar.time})
            ladder.remove(price); fills.append({"time": bar.time.isoformat(), "side": "BUY" if side == 1 else "SELL", "price": price, "lot": round(size, 4)})
            side_order.append(side)
        remaining = []
        for p in positions:
            target = p["entry"] + p["side"] * gap * tp_pct / 100
            hit = tp_pct > 0 and ((p["side"] == 1 and bar.high >= target) or (p["side"] == -1 and bar.low <= target))
            if hit: exits.append({"time": bar.time.isoformat(), "side": p["side"], "entry":p["entry"], "exit":target})
            else: remaining.append(p)
        positions = remaining; max_open = max(max_open, len(positions))
    switches = sum(a != b for a, b in zip(side_order, side_order[1:]))
    return {"symbol":symbol, "bars":len(bars), "from":bars[0].time.isoformat(), "to":bars[-1].time.isoformat(),
            "reference":ref, "gap":gap, "depth_requested":int(cfg.get("LadderDepthPerKind",5)),
            "active_stop_levels_per_side":depth, "fills":len(fills), "buy_fills":sum(x["side"]=="BUY" for x in fills),
            "sell_fills":sum(x["side"]=="SELL" for x in fills), "tp_exits":len(exits),
            "direction_switches":switches, "max_open_positions":max_open, "unclosed_positions":len(positions),
            "sample_fills":fills[:20],
            "warning":"Price-only mechanics research; validate all outcomes in MT5 Strategy Tester."}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--set", dest="setfile", type=Path, required=True)
    ap.add_argument("--data-dir", type=Path, required=True)
    ap.add_argument("--symbols", nargs="+", required=True)
    ap.add_argument("--output", type=Path, default=Path("reports/agg_pending"))
    a=ap.parse_args(); cfg=read_set(a.setfile); a.output.mkdir(parents=True, exist_ok=True)
    results=[]
    for symbol in a.symbols:
        files=list(a.data_dir.glob(f"{symbol}_M1_*.csv"))
        if not files: print(f"SKIP {symbol}: no M1 file"); continue
        result=simulate(symbol, read_bars(files[0]), cfg); results.append(result)
        (a.output/f"{symbol}.json").write_text(json.dumps(result, indent=2))
        print(f"{symbol}: {result['fills']} fills ({result['buy_fills']} buy / {result['sell_fills']} sell), {result['direction_switches']} switches, max open {result['max_open_positions']}")
    (a.output/"summary.json").write_text(json.dumps({"config":cfg,"results":results}, indent=2))
if __name__ == "__main__": main()
