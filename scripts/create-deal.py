#!/usr/bin/env python3
import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime
import urllib.request

from amazon_creatorsapi import AmazonCreatorsApi, Country
from amazon_creatorsapi.models import GetItemsResource

ASIN_RE = re.compile(r"^[A-Z0-9]{10}$", re.I)

def die(msg: str, code: int = 1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s[:90] if s else "offerta"

def euro_amount(value: str) -> str:
    # Normalizza a "12.34" se possibile
    try:
        return f"{float(value):.2f}"
    except Exception:
        return value

def build_affiliate_url(detail_url: str, asin: str, tag: str) -> str:
    if detail_url:
        if "tag=" in detail_url:
            return detail_url
        sep = "&" if "?" in detail_url else "?"
        return f"{detail_url}{sep}tag={tag}"
    return f"https://www.amazon.it/dp/{asin}?tag={tag}"

def telegram_send(token: str, chat_id: str, title: str, price: str, url: str, image_url: str, note: str):
    text = f"🔥 {title}\n"
    if price:
        text += f"💶 {price}€\n"
    if url:
        text += f"{url}"
    if note:
        text += f"\n\n📝 {note}"

    def post(method: str, payload: dict):
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/{method}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as r:
            return r.read().decode("utf-8")

    if image_url:
        # caption max ~1024
        post("sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": text[:1000]})
    else:
        post("sendMessage", {"chat_id": chat_id, "text": text})

def main():
    asin = (os.environ.get("ASIN") or "").strip().upper()
    note = (os.environ.get("NOTE") or "").strip()

    if not asin:
        die("Missing ASIN env var")
    if not ASIN_RE.match(asin):
        die(f"Invalid ASIN: {asin}")

    cred_id = os.environ.get("CREATORS_CREDENTIAL_ID")
    cred_secret = os.environ.get("CREATORS_CREDENTIAL_SECRET")
    version = os.environ.get("CREATORS_CREDENTIAL_VERSION", "2.2")
    tag = os.environ.get("AMAZON_ASSOCIATE_TAG")

    if not all([cred_id, cred_secret, tag]):
        die("Missing Creators API secrets (CREATORS_CREDENTIAL_ID/SECRET) or AMAZON_ASSOCIATE_TAG")

    api = AmazonCreatorsApi(
        credential_id=cred_id,
        credential_secret=cred_secret,
        version=version,
        tag=tag,
        country=Country.IT,
    )

    resources = [
        GetItemsResource.ITEMINFO_TITLE,
        GetItemsResource.IMAGES_PRIMARY_LARGE,
        GetItemsResource.OFFERSV2_LISTINGS_PRICE,
    ]

    items = api.get_items([asin], resources=resources)
    if not items:
        die("No items returned from API")

    item = items[0]

    title = asin
    if getattr(item, "item_info", None) and getattr(item.item_info, "title", None):
        title = item.item_info.title.display_value or asin

    image_url = ""
    if getattr(item, "images", None) and getattr(item.images, "primary", None) and getattr(item.images.primary, "large", None):
        image_url = item.images.primary.large.url or ""

    detail_url = getattr(item, "detail_page_url", "") or ""

    price = ""
    currency = ""
    if getattr(item, "offers_v2", None) and getattr(item.offers_v2, "listings", None):
        listings = item.offers_v2.listings
        if listings:
            p = getattr(listings[0], "price", None)
            if p and getattr(p, "money", None):
                price = str(p.money.amount) if p.money.amount is not None else ""
                currency = p.money.currency or ""

    # Link affiliato
    aff_url = build_affiliate_url(detail_url, asin, tag)

    # Crea file markdown in _posts/
    now = datetime.now()  # runner time; nel front matter mettiamo +0100 come da sito
    yyyy = now.strftime("%Y")
    mm = now.strftime("%m")
    dd = now.strftime("%d")
    HHMM = now.strftime("%H%M")

    filename = f"{yyyy}-{mm}-{dd}-{HHMM}-{slugify(title)}-{asin.lower()}.md"
    Path("_posts").mkdir(parents=True, exist_ok=True)
    out_path = Path("_posts") / filename

    safe_title = title.replace('"', '\\"')
    
    fm = [
        "---",
        "layout: deal",
        f'title: "{safe_title}"',
        f'asin: "{asin}"',
        f'image: "{image_url}"' if image_url else 'image: ""',
        f'price_current: {euro_amount(price)}' if price else 'price_current: ""',
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

    # Telegram (opzionale)
    tg_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    tg_chat = (os.environ.get("TELEGRAM_CHANNEL_ID") or "").strip()
    if tg_token and tg_chat:
        # prezzo solo se EUR o vuoto currency (su IT di solito EUR)
        price_for_tg = euro_amount(price) if price else ""
        telegram_send(tg_token, tg_chat, title, price_for_tg, aff_url, image_url, note)
        print("Telegram sent.")
    else:
        print("Telegram not configured; skipping.")

if __name__ == "__main__":
    main()
