#!/usr/bin/env python3
"""
Scan Solana swaps via Helius Enhanced Transactions (REST) for a set of token mints,
filtering to Raydium/Jupiter/Pump, and find wallets that bought multiple of those mints.

Outputs:
- raw_swaps.csv
- buyers_by_num_tokens.csv
"""

import os
import time
import csv
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------- CONFIG ----------------
HELIUS_API_KEY = os.getenv("HELIUS_API_KEY", '')

MINTS = [
    "DvMfyhVYqF7GFQESp15p8D8423614BcHX5KfiyS6BAGS",
    "Bm5ZikphdvZBW57bvrNs4njLkYFuQtBuPccamhxQBAGS",
]

# Keep swaps from these sources only (case-insensitive)
ALLOWED_SOURCES = {"RAYDIUM", "JUPITER", "PUMP"}

# Date window (UTC). Leave blank to fetch recent pages without time filtering.
SINCE = ""  # e.g., "2025-07-01T00:00:00Z"
UNTIL = ""  # e.g., "2025-08-09T23:59:59Z"

# Minimum distinct mints required to include a wallet in the final report
MIN_DISTINCT_MINTS = 0

# Pagination & pacing
PAGE_LIMIT = 100        # Helius limit per call (typically up to 100)
MAX_PAGES_PER_MINT = 1000000 # safety cap
SLEEP_BETWEEN_CALLS = 0.25
TIMEOUT = 30
# ---------------------------------------

BASE = "https://api.helius.xyz"

session = requests.Session()

def iso_to_ts(iso_str: str) -> Optional[int]:
    if not iso_str:
        return None
    return int(datetime.fromisoformat(iso_str.replace("Z", "+00:00")).timestamp())

SINCE_TS = iso_to_ts(SINCE) if SINCE else None
UNTIL_TS = iso_to_ts(UNTIL) if UNTIL else None

def guard(resp: requests.Response):
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        raise SystemExit(f"HTTP {resp.status_code}: {resp.text[:400]}")

def get_enhanced_for_address(address: str, before: Optional[str] = None) -> Dict:
    """
    Fetch enhanced transactions mentioning `address` (here, the mint address).
    Endpoint: GET /v0/addresses/{address}/transactions
    Supports query params: limit, before (signature), startTime, endTime
    """
    if not HELIUS_API_KEY or "YOUR_HELIUS_KEY" in HELIUS_API_KEY:
        raise SystemExit("Set HELIUS_API_KEY (env or in script).")

    params = {
        "api-key": HELIUS_API_KEY,
        "limit": PAGE_LIMIT,
    }
    if before:
        params["before"] = before
    if SINCE_TS:
        params["startTime"] = SINCE_TS
    if UNTIL_TS:
        params["endTime"] = UNTIL_TS

    url = f"{BASE}/v0/addresses/{address}/transactions"
    r = session.get(url, params=params, timeout=TIMEOUT)
    guard(r)
    return r.json()

def extract_buys_from_tx(tx: Dict, target_mint: str) -> List[Dict]:
    """
    Parse a single enhanced transaction object and return zero or more normalized swap rows
    that look like *buys* of target_mint from Raydium/Jupiter/Pump.
    """
    out = []
    sig = tx.get("signature")
    ts = tx.get("timestamp") or tx.get("blockTime")
    fee_payer = tx.get("feePayer") or tx.get("signer") or tx.get("account")  # best-effort
    events = tx.get("events") or {}

    # Prefer structured swap events
    swaps = events.get("swap") or events.get("swaps") or []
    if isinstance(swaps, dict):
        swaps = [swaps]

    for ev in swaps:
        # Example ev fields often include: source, tokenInputs, tokenOutputs, nativeInput, nativeOutput
        src = (ev.get("source") or "").upper()
        if ALLOWED_SOURCES and src and src not in ALLOWED_SOURCES:
            continue

        # See if target_mint appears among outputs (buyer receives the mint)
        outputs = ev.get("tokenOutputs") or []
        got_target = any((o.get("mint") == target_mint and (o.get("tokenAmount") or o.get("rawTokenAmount")))
                         for o in outputs)

        if not got_target:
            # Sometimes `tokenTransfers` is more reliable
            pass

        # Buyer attribution:
        # - If Helius provides "userAccount" / "taker" / "trader", use it; else fallback to feePayer.
        buyer = (ev.get("userAccount")
                 or ev.get("taker")
                 or ev.get("trader")
                 or fee_payer)

        if got_target and buyer:
            # Amount of target mint received (sum if multiple outputs of same mint)
            amt = 0.0
            for o in outputs:
                if o.get("mint") == target_mint:
                    v = o.get("tokenAmount")
                    if v is None:
                        v = o.get("rawTokenAmount", {}).get("tokenAmount")
                    try:
                        amt += float(v)
                    except Exception:
                        pass

            out.append({
                "buyer": buyer,
                "mint": target_mint,
                "amount": amt if amt else None,
                "tx": sig,
                "block_time": int(ts) if ts else None,
                "source": src or None,
            })

    # Fallback: if no structured swap match, infer from tokenTransfers (mint received)
    if not out:
        xfers = events.get("tokenTransfers") or []
        for xf in xfers:
            # expect fields: mint, toUserAccount, toUser, tokenAmount
            if xf.get("mint") != target_mint:
                continue
            buyer = xf.get("toUserAccount") or xf.get("toUser") or fee_payer
            if not buyer:
                continue
            # Try to infer source label if present at tx level
            src = None
            if swaps:
                # reuse any swap source we saw (even if outputs didn't match)
                s = (swaps[0].get("source") or "").upper()
                if s:
                    src = s
            # Only keep if allowed or if no filter set
            if ALLOWED_SOURCES and src and src not in ALLOWED_SOURCES:
                continue

            amt = xf.get("tokenAmount")
            try:
                amt = float(amt) if amt is not None else None
            except Exception:
                amt = None

            out.append({
                "buyer": buyer,
                "mint": target_mint,
                "amount": amt,
                "tx": sig,
                "block_time": int(ts) if ts else None,
                "source": src,
            })

    return out

def write_csv(path: str, rows: List[Dict], cols: List[str]):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in cols})

def main():
    if not HELIUS_API_KEY or "YOUR_HELIUS_KEY" in HELIUS_API_KEY:
        raise SystemExit("Set HELIUS_API_KEY first (export HELIUS_API_KEY=...).")

    all_rows: List[Dict] = []

    for idx, mint in enumerate(MINTS, 1):
        print(f"[{idx}/{len(MINTS)}] Scanning txs for mint {mint} ...")
        pages = 0
        before = None

        while pages < MAX_PAGES_PER_MINT:
            data = get_enhanced_for_address(mint, before=before)
            if not isinstance(data, list) or not data:
                break

            # Parse each transaction
            for tx in data:
                rows = extract_buys_from_tx(tx, mint)
                all_rows.extend(rows)

            # Pagination: use last signature as the next 'before'
            last_sig = data[-1].get("signature")
            if not last_sig or len(data) < PAGE_LIMIT:
                break

            before = last_sig
            pages += 1
            time.sleep(SLEEP_BETWEEN_CALLS)

    if not all_rows:
        print("No matching swaps found. Consider widening the date range or increasing MAX_PAGES_PER_MINT.")
        return

    # Write raw rows
    write_csv("raw_swaps.csv",
              all_rows,
              ["buyer", "mint", "amount", "tx", "block_time", "source"])
    print(f"Wrote raw_swaps.csv with {len(all_rows)} rows")

    # Aggregate buyers by distinct mints
    from collections import defaultdict
    mintset_by_buyer = defaultdict(set)
    examples_by_buyer = defaultdict(list)

    for r in all_rows:
        b = r.get("buyer")
        m = r.get("mint")
        if not b or not m:
            continue
        mintset_by_buyer[b].add(m)
        if len(examples_by_buyer[b]) < 5:
            examples_by_buyer[b].append({"mint": m, "tx": r.get("tx"), "time": r.get("block_time")})

    ranked = []
    for buyer, mset in mintset_by_buyer.items():
        if len(mset) >= MIN_DISTINCT_MINTS:
            ranked.append({
                "buyer": buyer,
                "num_distinct_mints": len(mset),
                "example_txns": json.dumps(examples_by_buyer[buyer]),
            })
    ranked.sort(key=lambda x: (-x["num_distinct_mints"], x["buyer"]))

    write_csv("buyers_by_num_tokens.csv",
              ranked,
              ["buyer", "num_distinct_mints", "example_txns"])
    print(f"Wrote buyers_by_num_tokens.csv with {len(ranked)} rows")
    print("Done.")

if __name__ == "__main__":
    main()
