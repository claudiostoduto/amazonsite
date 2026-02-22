import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const url = process.argv[2];
if (!url || !/^https?:\/\//i.test(url)) {
  console.error("Usage: node scripts/publish-offer.mjs <https://...>");
  process.exit(1);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function nowRome() {
  const d = new Date();
  // Formato coerente con i tuoi post: YYYY-MM-DD HH:MM:SS +0100 (fisso)
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return {
    yyyy,
    mm,
    dd,
    hh,
    mi,
    ss,
    hm: `${hh}${mi}`, // es: 1636
    dateFrontMatter: `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} +0100`
  };
}

function safeSlug(s) {
  return (s || "offerta")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "offerta";
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
      blocks.push(JSON.parse(txt.trim()));
    } catch {}
  });

  const flatten = (x) => (Array.isArray(x) ? x.flatMap(flatten) : [x]);
  const all = blocks.flatMap(flatten);

  for (const obj of all) {
    if (!obj || typeof obj !== "object") continue;

    const offers = obj.offers || obj.Offers;
    if (offers) {
      const arr = Array.isArray(offers) ? offers : [offers];
      for (const off of arr) {
        const price = off?.price ?? off?.Price;
        if (price != null) return String(price);
      }
    }

    if ((obj["@type"] === "Offer" || obj["@type"] === "AggregateOffer") && obj.price != null) {
      return String(obj.price);
    }
  }
  return null;
}

function parsePriceFromMeta($) {
  const amount = pickMeta($, "product:price:amount");
  return amount ? String(amount) : null;
}

function normalizePriceToItalianString(priceStr) {
  // ritorna "180,90" come nei tuoi post
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

  // due decimali, poi punto->virgola
  return n.toFixed(2).replace(".", ",");
}

function extractAsin(u) {
  const m1 = u.match(/\/dp\/([A-Z0-9]{10})/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = u.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (m2) return m2[1].toUpperCase();
  return null;
}

async function fetchHtml(u) {
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

  return { ok: false, html: "" };
}

const { ok: fetchOk, html } = await fetchHtml(url);
if (!fetchOk) {
  console.error("Fetch failed (will still publish): could not fetch page content");
}

const $ = cheerio.load(html || "<html></html>");

const fallbackTitle = url.includes("amazon.") ? "Offerta Amazon" : "Offerta";
const title =
  pickMeta($, "og:title", "twitter:title") ||
  $("title").first().text().trim() ||
  fallbackTitle;

const image = pickMeta($, "og:image", "twitter:image") || "";

const rawPrice = parseJsonLdOffers($) || parsePriceFromMeta($);
const price_current = rawPrice ? normalizePriceToItalianString(rawPrice) : "";

const asin = extractAsin(url);

const t = nowRome();
const slugBase = safeSlug(title);

// Come i tuoi post: time + slug + (asin o hash)
const tail = asin ? asin.toLowerCase() : crypto.createHash("sha1").update(url).digest("hex").slice(0, 10);
const filename = `${t.yyyy}-${t.mm}-${t.dd}-${t.hm}-${slugBase}-${tail}.md`;

const outDir = path.join(process.cwd(), "_posts");
fs.mkdirSync(outDir, { recursive: true });

const frontMatter = [
  "---",
  `layout: deal`,
  `title: "${title.replace(/"/g, '\\"')}"`,
  asin ? `asin: "${asin}"` : null,
  image ? `image: "${image}"` : `image: ""`,
  `price_current: "${price_current}"`,
  `price_list: ""`,
  `discount_pct: ""`,
  `amazon_url: "${url}"`,
  `date: ${t.dateFrontMatter}`,
  "---",
  ""
].filter(Boolean).join("\n");

fs.writeFileSync(path.join(outDir, filename), frontMatter, "utf8");

console.log("Created:", path.join("_posts", filename));
console.log("Title:", title);
console.log("Image:", image || "(none)");
console.log("Price:", price_current || "(none)");
console.log("ASIN:", asin || "(none)");
