#!/usr/bin/env python3
import os
import re
import sys
from datetime import datetime, timezone

from amazon_creatorsapi import AmazonCreatorsApi, Country
from amazon_creatorsapi.models import GetItemsResource

ASIN_RE = re.compile(r"^[A-Z0-9]{10}$", re.I)

def die(msg: str, code: int = 1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def main():
    asin = (os.environ.get("ASIN") or "").strip()
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
    title = item.item_info.title.display_value if item.item_info and item.item_info.title else asin
    img = (
        item.images.primary.large.url
        if item.images and item.images.primary and item.images.primary.large
        else ""
    )
    url = item.detail_page_url or ""

    price = ""
    currency = ""
    if item.offers_v2 and item.offers_v2.listings:
        p = item.offers_v2.listings[0].price
        if p and p.money:
            price = str(p.money.amount)
            currency = p.money.currency or ""

    # Output “env-style” to be captured by workflow
    print(f"TITLE={title}")
    print(f"IMAGE_URL={img}")
    print(f"DETAIL_URL={url}")
    print(f"PRICE={price}")
    print(f"CURRENCY={currency}")
    print("PRICE_TS=" + datetime.now(timezone.utc).isoformat())

if __name__ == "__main__":
    main()
