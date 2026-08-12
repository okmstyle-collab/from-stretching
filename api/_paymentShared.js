const DATA_SOURCE_ID = "37c383a5-097c-8069-8945-000bdf19ad94";
const NOTION_VERSION = "2026-03-11";
const RESERVATION_AMOUNT = 10000;
const RESERVATION_ORDER_NAME = "프롬 스트레칭 체험 예약금";

function send(response, status, payload) {
  response.status(status).json(payload);
}

function getNotionHeaders() {
  const notionToken = process.env.NOTION_TOKEN;

  if (!notionToken) {
    throw new Error("NOTION_TOKEN is not configured");
  }

  return {
    Authorization: `Bearer ${notionToken}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function getDataSourceId() {
  return process.env.NOTION_DATA_SOURCE_ID || DATA_SOURCE_ID;
}

function getOrigin(request) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");

  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  return `${protocol}://${host}`;
}

function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "");
}

function getTitle(property) {
  return property?.title?.map((item) => item.plain_text || item.text?.content || "").join("").trim() || "";
}

function getLeadSummary(page) {
  const properties = page?.properties || {};

  return {
    id: page?.id,
    name: getTitle(properties["이름"]),
    phone: properties["연락처"]?.phone_number || "",
    paymentStatus: properties["결제상태"]?.select?.name || "",
    paymentKey: properties["결제키"]?.rich_text?.map((item) => item.plain_text || item.text?.content || "").join("") || "",
  };
}

function createOrderId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `FS_${Date.now()}_${random}`;
}

function isValidOrderId(orderId) {
  return typeof orderId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(orderId);
}

async function getNotionPage(pageId) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: getNotionHeaders(),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function updateNotionPage(pageId, properties) {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: getNotionHeaders(),
    body: JSON.stringify({ properties }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Notion update failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

async function findLeadByOrderId(orderId) {
  const response = await fetch(`https://api.notion.com/v1/data_sources/${getDataSourceId()}/query`, {
    method: "POST",
    headers: getNotionHeaders(),
    body: JSON.stringify({
      filter: {
        property: "주문번호",
        rich_text: { equals: orderId },
      },
      page_size: 1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Notion query failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.results?.[0] || null;
}

function getTossBasicAuth() {
  const secretKey = process.env.TOSS_SECRET_KEY;

  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY is not configured");
  }

  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

module.exports = {
  RESERVATION_AMOUNT,
  RESERVATION_ORDER_NAME,
  createOrderId,
  findLeadByOrderId,
  getLeadSummary,
  getNotionPage,
  getOrigin,
  getTossBasicAuth,
  isValidOrderId,
  normalizePhone,
  send,
  updateNotionPage,
};
