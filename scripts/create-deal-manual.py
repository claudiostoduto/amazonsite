#!/usr/bin/env python3
import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime
import urllib.request

ASIN_RE = re.compile(r"[A-Z0-9]{10}", re.I)

def die(msg: str, code: int = 1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s[:90] or "offerta")

def extract_asin_from_url(url: str) -> str:
    if not url:
        return ""
    patterns = [r"/dp/([A-Z0-9]{10})", r"/gp/product/([A-Z0-9]{10})", r"asin=([A-Z0-9]{10})"]
    for pat in patterns:
        m = re.search(pat, url, flags=re.I)
        if m:
            return m.group(1).upper()
    return ""

def add_affiliate_tag(url: str, tag: str) -> str:
    if not url:
        return ""
    if not tag:
        return url
    if "tag=" in url:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}tag={tag}"

def tg_call(token: str, method: str, payload: dict):
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return r.read().decode("utf-8")

def telegram_send(token: str, chat_id: str, title: str, price: str, discount: str, url: str, image_url: str, note: str):
    text = f"🔥 {title}\n"
    if price:
        text += f"💶 {price}€"
        if discount:
            text += f" (-{discount}%)"
        text += "\n"
    if url:
        text += f"{url}"
    if note:
        text += f"\n\n📝 {note}"

    if image_url:
        tg_call(token, "sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": text[:1000]})
    else:
        tg_call(token, "sendMessage", {"chat_id": chat_id, "text": text})

def main():
    title = (os.environ.get("TITLE") or "").strip()
    url = (os.environ.get("URL") or "").strip()
    image = (os.environ.get("IMAGE_URL") or "").strip()
    price = (os.environ.get("PRICE") or "").strip()
    discount = (os.environ.get("DISCOUNT_PCT") or "").strip()
    note = (os.environ.get("NOTE") or "").strip()
    tag = (os.environ.get("AMAZON_ASSOCIATE_TAG") or "").strip()

    if not title:
        die("Missing TITLE")
    if not url:
        die("Missing URL")

    asin = extract_asin_from_url(url)
    aff_url = add_affiliate_tag(url, tag)

    now = datetime.now()
    yyyy = now.strftime("%Y")
    mm = now.strftime("%m")
    dd = now.strftime("%d")
    HHMM = now.strftime("%H%M")

    safe_title = title.replace('"', '\\"')
    filename = f"{yyyy}-{mm}-{dd}-{HHMM}-{slugify(title)}{('-'+asin.lower()) if asin else ''}.md"
    Path("_posts").mkdir(parents=True, exist_ok=True)
    out_path = Path("_posts") / filename

    fm = [
        "---",
        "layout: deal",
        f'title: "{safe_title}"',
        f'asin: "{asin}"',
        f'image: "{image}"' if image else 'image: ""',
        f'price_current: "{price}"' if price else 'price_current: ""',
        'price_list: ""',
        f'discount_pct: "{discount}"' if discount else 'discount_pct: ""',
        f'amazon_url: "{aff_url}"',
        f"date: {now.strftime('%Y-%m-%d %H:%M:00 +0100')}",
        "---",
        "",
    ]
    out_path.write_text("\n".join(fm) + (note + "\n" if note else ""), encoding="utf-8")
    print(f"Created post: {out_path}")

    tg_token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    tg_chat = (os.environ.get("TELEGRAM_CHANNEL_ID") or "").strip()
    if tg_token and tg_chat:
        telegram_send(tg_token, tg_chat, title, price, discount, aff_url, image, note)
        print("Telegram sent.")
    else:
        print("Telegram not configured; skipping.")

if __name__ == "__main__":
    main()
