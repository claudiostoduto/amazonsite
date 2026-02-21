import crypto from "crypto";

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(encoding);
}
function sha256(data, encoding) {
  return crypto.createHash("sha256").update(data, "utf8").digest(encoding);
}
function getSignatureKey(secret, dateStamp, region, service) {
  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export async function paapiGetItems({
  accessKey,
  secretKey,
  partnerTag,
  asin,
  region = "eu-west-1",
  host = "webservices.amazon.it",
  marketplace = "www.amazon.it",
}) {
  const service = "ProductAdvertisingAPI";
  const endpoint = `https://${host}/paapi5/getitems`;

  const amzTarget = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const HH = String(now.getUTCHours()).padStart(2, "0");
  const MM = String(now.getUTCMinutes()).padStart(2, "0");
  const SS = String(now.getUTCSeconds()).padStart(2, "0");

  const amzDate = `${yyyy}${mm}${dd}T${HH}${MM}${SS}Z`;
  const dateStamp = `${yyyy}${mm}${dd}`;

  const payloadObj = {
    ItemIds: [asin],
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: marketplace,
    Resources: [
      "Images.Primary.Large",
      "ItemInfo.Title",
      "Offers.Listings.Price",
      "Offers.Listings.SavingBasis",
      "Offers.Listings.Savings",
    ],
  };
  const payload = JSON.stringify(payloadObj);

  const contentType = "application/json; charset=utf-8";
  const canonicalUri = "/paapi5/getitems";
  const canonicalQuerystring = "";

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${amzTarget}\n`;

  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const payloadHash = sha256(payload, "hex");

  const canonicalRequest =
    `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest, "hex")}`;

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = hmac(signingKey, stringToSign, "hex");

  const authorizationHeader =
    `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": contentType,
      host,
      "x-amz-date": amzDate,
      "x-amz-target": amzTarget,
      Authorization: authorizationHeader,
    },
    body: payload,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`PA-API HTTP ${res.status}: ${JSON.stringify(json)}`);

  const item = json?.ItemsResult?.Items?.[0];
  if (!item) throw new Error("PA-API: item not found in response");

  const title = item?.ItemInfo?.Title?.DisplayValue ?? "";
  const image = item?.Images?.Primary?.Large?.URL ?? "";

  const listing = item?.Offers?.Listings?.[0];
  const priceCurrent = listing?.Price?.Amount ?? null;
  const priceList = listing?.SavingBasis?.Amount ?? null;

  let discountPct = null;
  if (priceCurrent != null && priceList != null && priceList > 0) {
    discountPct = Math.round(((priceList - priceCurrent) / priceList) * 100);
  }

  return { asin, title, image, priceCurrent, priceList, discountPct };
}
