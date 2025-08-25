#!/usr/bin/env python3
"""
Find Solana wallets that bought multiple tokens from a given list of token mints.

Providers supported:
- Birdeye (easy): requires BIRDEYE_API_KEY env var or set in config
- Helius (richer parsing): requires HELIUS_API_KEY env var or set in config

Outputs:
- raw_trades.csv: normalized trades per mint (buyer, mint, amount, tx, time)
- buyers_by_num_tokens.csv: buyers ranked by how many distinct mints they bought
"""

import os
import sys
import time
import math
import csv
import json
import argparse
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple
import requests

load_dotenv()

# =============== CONFIG ===============
MINTS = [
    "H3kviw9zovZLbv3hu1tXf7rZjqrT6UemKXia8HdBpump",
    "DvMfyhVYqF7GFQESp15p8D8423614BcHX5KfiyS6BAGS",
    "Bm5ZikphdvZBW57bvrNs4njLkYFuQtBuPccamhxQBAGS",
    "A5bGiYPVG92AvmupFsnwEYzWuWz4BFR5i9bCsew6pump",
    "HWUz6CoWfdBgLwbaqrR3X8TnL9GX64MawmtGiWvApump",
    "B7KoKeMge7ctw4Gv6f3anA6Bu4rt9E53p5saHGymBAGS",
    "Aj27AMdcxtKvmuhbM2D6wcSWmFGCo8bST7g5BYDNBAGS"
]

# Choose provider: "birdeye" or "helius"
PROVIDER = "helius"

# API keys (env overrides take precedence)
BIRDEYE_API_KEY = os.getenv("BIRDEYE_API_KEY", '')
HELIUS_API_KEY  = os.getenv("HELIUS_API_KEY",  '')

# Date range (UTC). Empty means "no limit" for that side.
SINCE = ""  # e.g., "2025-07-01T00:00:00Z"
UNTIL = ""  # e.g., "2025-08-09T23:59:59Z"

# Minimum distinct mints a buyer must have purchased to be included in final ranking
MIN_DISTINCT_MINTS = 2

# Pagination / rate-limit knobs
PAGE_LIMIT = 200         # max records per page if provider allows
MAX_PAGES_PER_MINT = 50  # safety cap
SLEEP_BETWEEN_CALLS = 0.25  # seconds
TIMEOUT = 30
# =====================================

def iso_to_ts(iso_str: str) -> Optional[int]:
    if not iso_str:
        return None
    return int(datetime.fromisoformat(iso_str.replace("Z","+00:00")).timestamp())

SINCE_TS = iso_to_ts(SINCE) if SINCE else None
UNTIL_TS = iso_to_ts(UNTIL) if UNTIL else None

session = requests.Session()

def _guard_ok(resp: requests.Response):
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        text = resp.text[:400]
        raise SystemExit(f"HTTP {resp.status_code}: {text}") from e

# ---------- Birdeye adapter ----------
def fetch_trades_birdeye_for_mint(mint: str) -> List[Dict]:
    """
    Fetch recent swap/buy trades for a mint from Birdeye.

    NOTE: Birdeye has multiple endpoints; this script uses a generic trades history style.
    If your plan uses a different endpoint, adjust URL/params but keep the normalization.
    """
    if not BIRDEYE_API_KEY or "YOUR_BIRDEYE_KEY" in BIRDEYE_API_KEY:
        raise SystemExit("Birdeye selected but no BIRDEYE_API_KEY set. Set env var or edit config.")

    headers = {
        "accept": "application/json",
        "X-API-KEY": BIRDEYE_API_KEY,
    }

    # Example endpoint pattern (adjust if your Birdeye plan uses a different path):
    # Docs vary by plan; you may have /defi/txs/token or /defi/trades.
    # The goal is: get swaps involving `mint`, with taker/buyer info and timestamp.
    base_url = "https://public-api.birdeye.so/defi/txs/token"

    out = []
    offset = 0
    page = 0

    while page < MAX_PAGES_PER_MINT:
        params = {
            "address": mint,
            "limit": PAGE_LIMIT,
            "offset": offset,
            "sort_by": "blockTime",
            "sort_type": "desc",
        }
        resp = session.get(base_url, headers=headers, params=params, timeout=TIMEOUT)
        _guard_ok(resp)
        data = resp.json()

        items = data.get("data", {}).get("items") or data.get("data") or data.get("items") or []
        if not items:
            break

        for it in items:
            # Birdeye response shapes differ; normalize generously
            block_time = it.get("blockTime") or it.get("time") or it.get("blocktime") or it.get("slotTime")
            if isinstance(block_time, str) and block_time.isdigit():
                block_time = int(block_time)
            elif isinstance(block_time, str):
                # If ISO string
                try:
                    block_time = iso_to_ts(block_time)
                except Exception:
                    block_time = None

            if not isinstance(block_time, (int, float)):
                # Sometimes they give ms; normalize to seconds if looks too big
                bt = it.get("block_time_ms") or it.get("timestamp")
                if bt:
                    block_time = int(bt) // 1000

            # Filter by date window if set
            if SINCE_TS and block_time and block_time < SINCE_TS:
                continue
            if UNTIL_TS and block_time and block_time > UNTIL_TS:
                continue

            # Try to identify buyer/taker & amounts
            buyer = it.get("taker") or it.get("signer") or it.get("trader") or it.get("owner")
            tx = it.get("txHash") or it.get("signature") or it.get("tx") or it.get("transaction")
            # Amount bought of the mint (best-effort)
            amount_in = it.get("amountIn") or it.get("amount") or it.get("tokenAmount") or 0

            # Heuristic: ensure this is a swap that *bought* the mint.
            # Some payloads include 'baseMint'/'quoteMint' or similar. If available, prefer rows where mint is 'tokenIn' or 'tokenOut' depending on semantics.
            base = it.get("baseMint") or it.get("base") or it.get("inputMint")
            quote = it.get("quoteMint") or it.get("quote") or it.get("outputMint")
            # We won't strictly filter buy vs sell here; we just attribute trades touching the mint.
            # If you want *only buys*, uncomment a direction check once you confirm your endpoint fields.

            out.append({
                "buyer": buyer,
                "mint": mint,
                "amount": float(amount_in) if isinstance(amount_in, (int, float, str)) and str(amount_in).replace('.','',1).isdigit() else None,
                "tx": tx,
                "block_time": int(block_time) if block_time else None,
                "provider": "birdeye",
            })

        got = len(items)
        if got < PAGE_LIMIT:
            break
        offset += got
        page += 1
        time.sleep(SLEEP_BETWEEN_CALLS)

    return out

# ---------- Helius adapter ----------
def fetch_trades_helius_for_mint(mint: str) -> List[Dict]:
    """
    Use Helius 'Enhanced' data to find swap-like events where the target mint is received.
    We scan recent transactions mentioning the mint ATA and parse token transfers.

    NOTE: This is a generalized approach; for heavy historical ranges you should
    scope by programIds (Jupiter/Orca/Raydium) or use webhooks / bulk exports.
    """
    if not HELIUS_API_KEY or "YOUR_HELIUS_KEY" in HELIUS_API_KEY:
        raise SystemExit("Helius selected but no HELIUS_API_KEY set. Set env var or edit config.")

    headers = {"accept": "application/json", "content-type": "application/json"}
    url = f"https://api.helius.xyz/v0/token-transfers?api-key={HELIUS_API_KEY}"

    # Narrow by mint, with optional time bounds. Page using 'cursor' if present.
    payload = {
        "mint": mint,
        "limit": PAGE_LIMIT,
        "sort": "desc",
    }
    if SINCE_TS:
        payload["startTime"] = SINCE_TS
    if UNTIL_TS:
        payload["endTime"] = UNTIL_TS

    out = []
    page = 0
    cursor = None

    while page < MAX_PAGES_PER_MINT:
        if cursor:
            payload["cursor"] = cursor

        resp = session.post(url, headers=headers, data=json.dumps(payload), timeout=TIMEOUT)
        _guard_ok(resp)
        data = resp.json()
        items = data.get("result") or data.get("tokenTransfers") or data.get("items") or []
        if not items:
            break

        for it in items:
            # Heuristics: treat incoming transfers of `mint` to a user ATA as a "buy"
            # (strict DEX-only buys would require checking inner instructions/program IDs)
            to_user = it.get("toUserAccount") or it.get("toUser") or it.get("toOwner")
            from_user = it.get("fromUserAccount") or it.get("fromUser") or it.get("fromOwner")
            sig = it.get("signature") or it.get("transactionSignature")
            ts = it.get("timestamp") or it.get("blockTime")
            amt = it.get("tokenAmount") or it.get("amount")

            # Keep only *incoming* mint transfers to a user (exclude airdrops by later filtering if needed)
            if to_user:
                out.append({
                    "buyer": to_user,   # recipient — approximate "buyer"
                    "mint": mint,
                    "amount": float(amt) if amt is not None else None,
                    "tx": sig,
                    "block_time": int(ts) if ts else None,
                    "provider": "helius",
                })

        cursor = data.get("pagination", {}).get("next") or data.get("next") or None
        if not cursor:
            break

        page += 1
        time.sleep(SLEEP_BETWEEN_CALLS)

    return out

def fetch_for_mint(mint: str) -> List[Dict]:
    if PROVIDER.lower() == "birdeye":
        return fetch_trades_birdeye_for_mint(mint)
    elif PROVIDER.lower() == "helius":
        return fetch_trades_helius_for_mint(mint)
    else:
        raise SystemExit(f"Unknown provider: {PROVIDER}")

def to_csv(rows: List[Dict], path: str):
    if not rows:
        return
    cols = ["buyer", "mint", "amount", "tx", "block_time", "provider"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in cols})

def group_buyers(rows: List[Dict]) -> List[Dict]:
    from collections import defaultdict

    # Map: buyer -> set of mints + some extras
    mints_by_buyer = defaultdict(set)
    examples_by_buyer = defaultdict(list)

    for r in rows:
        b = r.get("buyer")
        m = r.get("mint")
        if not b or not m:
            continue
        mints_by_buyer[b].add(m)
        if len(examples_by_buyer[b]) < 5:
            examples_by_buyer[b].append({"mint": m, "tx": r.get("tx"), "time": r.get("block_time")})

    out = []
    for buyer, mintset in mints_by_buyer.items():
        if len(mintset) >= MIN_DISTINCT_MINTS:
            out.append({
                "buyer": buyer,
                "num_distinct_mints": len(mintset),
                "example_txns": json.dumps(examples_by_buyer[buyer]),
            })
    out.sort(key=lambda x: (-x["num_distinct_mints"], x["buyer"]))
    return out

def main():
    global PROVIDER, SINCE_TS, UNTIL_TS, MIN_DISTINCT_MINTS

    parser = argparse.ArgumentParser(description="Find Solana wallets that bought multiple tokens from a mint list.")
    parser.add_argument("--mints", type=str, help="Path to a file containing one mint per line (optional).")
    parser.add_argument("--since", type=str, help="ISO start time (UTC), e.g. 2025-07-01T00:00:00Z")
    parser.add_argument("--until", type=str, help="ISO end time (UTC), e.g. 2025-08-09T23:59:59Z")
    parser.add_argument("--provider", type=str, choices=["birdeye","helius"], help="Data provider to use.")
    parser.add_argument("--min-mints", type=int, default=MIN_DISTINCT_MINTS, help="Min distinct mints per buyer to include.")
    parser.add_argument("--out-prefix", type=str, default=".", help="Directory to write CSVs.")
    args = parser.parse_args()

    if args.provider:
        PROVIDER = args.provider

    if args.since:
        ts = iso_to_ts(args.since)
        if not ts:
            raise SystemExit("Invalid --since")
        SINCE_TS = ts
    if args.until:
        ts = iso_to_ts(args.until)
        if not ts:
            raise SystemExit("Invalid --until")
        UNTIL_TS = ts
    if args.min_mints:
        MIN_DISTINCT_MINTS = int(args.min_mints)

    mints = list(MINTS)
    if args.mints:
        with open(args.mints, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if s and not s.startswith("#"):
                    mints.append(s)
    mints = sorted(set([m for m in mints if m]))

    if not mints:
        raise SystemExit("No mints provided. Add them in the script or pass --mints path.")

    print(f"Provider: {PROVIDER}")
    print(f"Mints: {len(mints)}")
    if SINCE_TS:
        print("Since:", datetime.fromtimestamp(SINCE_TS, tz=timezone.utc).isoformat())
    if UNTIL_TS:
        print("Until:", datetime.fromtimestamp(UNTIL_TS, tz=timezone.utc).isoformat())

    all_rows: List[Dict] = []
    for i, mint in enumerate(mints, 1):
        print(f"[{i}/{len(mints)}] Fetching trades for mint {mint} ...")
        try:
            rows = fetch_for_mint(mint)
            print(f"  -> got {len(rows)} rows")
            all_rows.extend(rows)
        except Exception as e:
            print(f"  !! error on {mint}: {e}")
        time.sleep(SLEEP_BETWEEN_CALLS)

    if not all_rows:
        print("No trades found.")
        return

    os.makedirs(args.out_prefix, exist_ok=True)
    raw_path = os.path.join(args.out_prefix, "raw_trades.csv")
    to_csv(all_rows, raw_path)
    print(f"Wrote {raw_path} with {len(all_rows)} rows")

    grouped = group_buyers(all_rows)
    buyers_path = os.path.join(args.out_prefix, "buyers_by_num_tokens.csv")
    cols = ["buyer", "num_distinct_mints", "example_txns"]
    with open(buyers_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in grouped:
            w.writerow(r)

    print(f"Wrote {buyers_path} with {len(grouped)} rows")
    print("Done.")

if __name__ == "__main__":
    main()
