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
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  // Nota: +0100 fisso (ok per Jekyll; se vuoi gestiamo DST dopo)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} +0100`;
}

function pickMeta($, property, name) {
  const byProp = $(`meta[property="${property}"]`).attr("content");
  if (byProp) return byProp.trim();
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

  const flatten = (x) => (Array.isArray(x) ? x.flatMap(flatten) : [x]);
  const all = blocks.flatMap(flatten);

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
  const amount = pickMeta($, "product:price:amount");
  const currency = pickMeta($, "product:price:currency");
  if (amount) return { price: amount, currency: currency || null };
  return null;
}

function normalizePrice(priceStr) {
  const s = String(priceStr).trim();
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

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

function extractAsin(u) {
  const m1 = u.match(/\/dp\/([A-Z0-9]{10})/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = u.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (m2) return m2[1].toUpperCase();
  return null;
}

async function fetchHtml(u) {
  // Headers più "browser-like"
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "it-IT,it;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache"
  };

  // 2 tentativi
  for (let i = 0; i < 2; i++) {
    const res = await fetch(u, { redirect: "follow", headers });
    if (res.ok) return { ok: true, html: await res.text() };
  }

  // Se non ok: non blocchiamo, pubblichiamo comunque
  return { ok: false, html: "" };
}

const { ok: fetchOk, html } = await fetchHtml(url);
if (!fetchOk) {
  console.error("Fetch failed (will still publish): could not fetch page content");
}

const $ = cheerio.load(html || "<html></html>");

const fallbackTitle = url.includes("amazon.") ? "Offerta Amazon" : "Offerta";

// Title
const title =
  pickMeta($, "og:title", "twitter:title") ||
  $("title").first().text().trim() ||
  fallbackTitle;

// Image
const image = pickMeta($, "og:image", "twitter:image") || null;

// Price
let priceInfo = parseJsonLdOffers($) || parsePriceFromMeta($);
let price = priceInfo?.price ? normalizePrice(priceInfo.price) : null;

// ASIN
const asin = extractAsin(url);

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
  "layout: deal",
  `title: "${title.replace(/"/g, '\\"')}"`,
  `amazon_url: "${url}"`,
  image ? `image: "${image}"` : null,
  asin ? `asin: ${asin}` : null,
  price ? `price_current: ${price}` : null,
  // se ti serve nel template, puoi tenerlo:
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
console.log("Price:", price ? `${price} EUR` : "(none)");
console.log("ASIN:", asin || "(none)");
