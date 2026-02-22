import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const url = process.argv[2];
if (!url || !/^https?:\/\//i.test(url)) {
  console.error("Usage: node scripts/publish-offer.mjs <https://...>");
  process.exit(1);
}

function safeSlug(s) {
  return (s || "offerta")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "offerta";
}

function nowRomeISO() {
  // Non usiamo librerie: per Jekyll basta una stringa coerente
  const d = new Date();
  // formato: YYYY-MM-DD HH:MM:SS +0100/+0200 (qui mettiamo +0100 “fisso” per semplicità)
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} +0100`;
}

function pickMeta($, property, name) {
  // <meta property="og:title" content="...">
  const byProp = $(`meta[property="${property}"]`).attr("content");
  if (byProp) return byProp.trim();
  // <meta name="twitter:title" content="...">
  if (name) {
    const byName = $(`meta[name="${name}"]`).attr("content");
    if (byName) return byName.trim();
  }
  return null;
}

function parseJsonLdOffers($) {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt.trim());
      blocks.push(parsed);
    } catch {}
  });

  const flatten = (x) => Array.isArray(x) ? x.flatMap(flatten) : [x];

  const all = blocks.flatMap(flatten);

  // Cerca oggetti con offers
  for (const obj of all) {
    if (!obj || typeof obj !== "object") continue;

    // Product -> offers
    const offers = obj.offers || obj.Offers;
    if (offers) {
      const arr = Array.isArray(offers) ? offers : [offers];
      for (const off of arr) {
        const price = off?.price ?? off?.Price;
        const currency = off?.priceCurrency ?? off?.pricecurrency;
        if (price != null) return { price: String(price), currency: currency || null };
      }
    }

    // Offer diretto
    if ((obj["@type"] === "Offer" || obj["@type"] === "AggregateOffer") && obj.price != null) {
      return { price: String(obj.price), currency: obj.priceCurrency || null };
    }
  }
  return null;
}

function parsePriceFromMeta($) {
  // meta property="product:price:amount"
  const amount = pickMeta($, "product:price:amount");
  const currency = pickMeta($, "product:price:currency");
  if (amount) return { price: amount, currency: currency || null };
  return null;
}

function normalizePrice(priceStr) {
  // accetta "1.234,56" o "1234.56"
  const s = String(priceStr).trim();
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  // se ha sia . che , assumiamo . migliaia e , decimali
  let normalized = cleaned;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

const res = await fetch(url, {
  redirect: "follow",
  headers: {
    "user-agent": "Mozilla/5.0 (offer-bot; +https://github.com/claudiostoduto/amazonsite)"
  }
});

if (!res.ok) {
  console.error("Fetch failed:", res.status, res.statusText);
  process.exit(1);
}

const html = await res.text();
const $ = cheerio.load(html);

// Title
const title =
  pickMeta($, "og:title", "twitter:title") ||
  $("title").first().text().trim() ||
  "Offerta";

// Image
const image =
  pickMeta($, "og:image", "twitter:image") ||
  null;

// Price
let priceInfo = parseJsonLdOffers($) || parsePriceFromMeta($);
let price = priceInfo?.price ? normalizePrice(priceInfo.price) : null;
let currency = priceInfo?.currency || "EUR";

// File output
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");

const slugBase = safeSlug(title);
const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 6);
const filename = `${yyyy}-${mm}-${dd}-${slugBase}-${hash}.md`;

const outDir = path.join(process.cwd(), "_posts");
fs.mkdirSync(outDir, { recursive: true });

const frontMatter = [
  "---",
  'layout: offer',
  `title: "${title.replace(/"/g, '\\"')}"`,
  image ? `image: "${image}"` : null,
  `source_url: "${url}"`,
  price ? `price: ${price}` : null,
  currency ? `currency: "${currency}"` : null,
  `published_at: "${nowRomeISO()}"`,
  "---",
  "",
  "Offerta pubblicata automaticamente.",
  ""
].filter(Boolean).join("\n");

fs.writeFileSync(path.join(outDir, filename), frontMatter, "utf8");

console.log("Created:", path.join("_posts", filename));
console.log("Title:", title);
console.log("Image:", image || "(none)");
console.log("Price:", price ? `${price} ${currency}` : "(none)");
