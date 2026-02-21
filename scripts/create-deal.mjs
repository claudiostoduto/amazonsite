import fs from "fs";
import path from "path";
import { paapiGetItems } from "./paapi.mjs";

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}
function euro(n) {
  if (n == null || n === "") return "";
  return Number(n).toFixed(2);
}

const asin = (process.env.ASIN || "").trim().toUpperCase();
const note = (process.env.NOTE || "").trim();

if (!asin || asin.length !== 10) {
  console.error("Missing/invalid ASIN env var (must be 10 chars)");
  process.exit(1);
}

const accessKey = process.env.AMAZON_ACCESS_KEY;
const secretKey = process.env.AMAZON_SECRET_KEY;
const partnerTag = process.env.AMAZON_ASSOCIATE_TAG;

if (!accessKey || !secretKey || !partnerTag) {
  console.error("Missing Amazon secrets");
  process.exit(1);
}

const data = await paapiGetItems({ accessKey, secretKey, partnerTag, asin });

const titleSafe = data.title || `Offerta (${asin})`;
const slug = `${slugify(titleSafe)}-${asin.toLowerCase()}`;

const now = new Date(); // runner is UTC; but we store +0100 per tuo sito
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
const HH = String(now.getHours()).padStart(2, "0");
const MM = String(now.getMinutes()).padStart(2, "0");

const filename = `${yyyy}-${mm}-${dd}-${HH}${MM}-${slug}.md`;
const outPath = path.join("_posts", filename);

// link affiliato semplice
const amazonUrl = `https://www.amazon.it/dp/${asin}?tag=${partnerTag}`;

const fm = [
  "---",
  "layout: deal",
  `title: "${titleSafe.replace(/"/g, '\\"')}"`,
  `asin: "${asin}"`,
  `image: "${data.image || ""}"`,
  `price_current: ${data.priceCurrent != null ? euro(data.priceCurrent) : '""'}`,
  `price_list: ${data.priceList != null ? euro(data.priceList) : '""'}`,
  `discount_pct: ${data.discountPct != null ? data.discountPct : '""'}`,
  `amazon_url: "${amazonUrl}"`,
  `date: ${yyyy}-${mm}-${dd} ${HH}:${MM}:00 +0100`,
  "---",
  "",
].join("\n");

fs.mkdirSync("_posts", { recursive: true });
fs.writeFileSync(outPath, fm + (note ? `${note}\n` : ""), "utf8");
console.log(`Created: ${outPath}`);

// Telegram (opzionale)
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const tgChat = process.env.TELEGRAM_CHANNEL_ID;

if (tgToken && tgChat) {
  const priceLine = data.priceCurrent != null ? `💶 ${euro(data.priceCurrent)}€` : "";
  const discLine = data.discountPct != null ? ` (-${data.discountPct}%)` : "";
  const text =
    `🔥 ${titleSafe}\n` +
    `${priceLine}${discLine}\n` +
    `${amazonUrl}` +
    (note ? `\n\n📝 ${note}` : "");

  if (data.image) {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendPhoto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChat,
        photo: data.image,
        caption: text.slice(0, 1000),
      }),
    });
  } else {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: tgChat, text }),
    });
  }
  console.log("Telegram sent.");
} else {
  console.log("Telegram not configured; skipping.");
}
