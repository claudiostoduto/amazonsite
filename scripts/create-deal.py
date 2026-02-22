#!/usr/bin/env python3
import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime
import urllib.request

from amazon_creatorsapi import AmazonCreatorsApi, Country, get_asin

ASIN_RE = re.compile(r"^[A-Z0-9]{10}$", re.I)

def die(msg: str, code: int = 1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s[:90] or "offerta")

def euro_amount(value):
    try:
        return f"{float(value):.2f}"
    except Exception:
        return ""

def build_affiliate_url(detail_url: str, asin: str, tag: str) -> str:
    if detail_url:
        if "tag=" in detail_url:
            return detail_url
        sep = "&" if "?" in detail_url else "?"
        return f"{detail_url}{sep}tag={tag}"
    return f"https://www.amazon.it/dp/{asin}?tag={tag}"

def tg_call(token: str, method: str, payload: dict):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return r.read().decode("utf-8")

def telegram_send(token: str, chat_id: str, title: str, price: str, url: str, image_url: str, note: str):
    text = f"🔥 {title}\n"
    if price:
        text += f"💶 {price}€\n"
    if url:
        text += f"{url}"
    if note:
        text += f"\n\n📝 {note}"

    if image_url:
        tg_call(token, "sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": text[:1000]})
    else:
        tg_call(token, "sendMessage", {"chat_id": chat_id, "text": text})

def main():
    raw = (os.environ.get("ASIN") or "").strip()
    note = (os.environ.get("NOTE") or "").strip()

    if not raw:
        die("Missing ASIN env var (you can also pass an Amazon URL)")

    asin = raw.upper()
    if not ASIN_RE.match(asin):
        try:
            asin = get_asin(raw).upper()
        except Exception:
            die(f"Invalid ASIN/URL: {raw}")
    if not ASIN_RE.match(asin):
        die(f"Invalid ASIN: {asin}")

    cred_id = (os.environ.get("CREATORS_CREDENTIAL_ID") or "").strip()
    cred_secret = (os.environ.get("CREATORS_CREDENTIAL_SECRET") or "").strip()
    version = (os.environ.get("CREATORS_CREDENTIAL_VERSION") or "2.2").strip()
    tag = (os.environ.get("AMAZON_ASSOCIATE_TAG") or "").strip()

    if not cred_id or not cred_secret:
        die("Missing Creators API credentials: CREATORS_CREDENTIAL_ID / CREATORS_CREDENTIAL_SECRET")
    if not tag:
        die("Missing AMAZON_ASSOCIATE_TAG secret (your affiliate tag, e.g. xxx-21)")

    api = AmazonCreatorsApi(
        credential_id=cred_id,
        credential_secret=cred_secret,
        version=version,
        tag=tag,
        country=Country.IT,
    )

    # IMPORTANT: With Creators API wrapper, resources are included by default.
    items = api.get_items([asin])
    if not items:
        die("No items returned from Creators API")
    item = items[0]

    title = asin
    try:
        title = item.item_info.title.display_value or asin
    except Exception:
        pass

    image_url = ""
    try:
        image_url = item.images.primary.large.url or ""
    except Exception:
        pass

    detail_url = ""
    try:
        detail_url = item.detail_page_url or ""
    except Exception:
        pass

    price = ""
    try:
        if item.offers_v2 and item.offers_v2.listings:
            listing = item.offers_v2.listings[0]
            if listing.price and listing.price.money and listing.price.money.amount is not None:
                price = euro_amount(listing.price.money.amount)
    except Exception:
        pass

    aff_url = build_affiliate_url(detail_url, asin, tag)

    now = datetime.now()
    yyyy = now.strftime("%Y")
    mm = now.strftime("%m")
    dd = now.strftime("%d")
    HHMM = now.strftime("%H%M")

    safe_title = (title or asin).replace('"', '\\"')
    filename = f"{yyyy}-{mm}-{dd}-{HHMM}-{slugify(title)}-{asin.lower()}.md"
    Path("_posts").mkdir(parents=True, exist_ok=True)
    out_path = Path("_posts") / filename

    fm = [
        "---",
        "layout: deal",
        f'title: "{safe_title}"',
        f'asin: "{asin}"',
        f'image: "{image_url}"' if image_url else 'image: ""',
        f'price_current: "{price}"' if price else 'price_current: ""',
        'price_list: ""',
        'discount_pct: ""',
        f'amazon_url: "{aff_url}"',
        f"date: {now.strftime('%Y-%m-%d %H:%M:00 +0100')}",
        "---",
        "",
    ]
    content = "\n".join(fm) + (note + "\n" if note else "")
    out_path.write_text(content, encoding="utf-8")
    print(f"Created post: {out_path}")

    tg_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    tg_chat = (os.environ.get("TELEGRAM_CHANNEL_ID") or "").strip()
    if tg_token and tg_chat:
        telegram_send(tg_token, tg_chat, title, price, aff_url, image_url, note)
        print("Telegram sent.")
    else:
        print("Telegram not configured; skipping.")

if __name__ == "__main__":
    main()
