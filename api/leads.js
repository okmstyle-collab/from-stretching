const ALLOWED_BRANCHES = new Set(["송도점", "작전점", "부평점"]);
const ALLOWED_CONCERNS = new Set(["목", "어깨", "등", "허리", "골반", "기타"]);
const DATA_SOURCE_ID = "37c383a5-097c-8069-8945-000bdf19ad94";

function send(response, status, payload) {
  response.status(status).json(payload);
}

function isValidPreferredAt(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() > Date.now() &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  );
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { ok: false, message: "지원하지 않는 요청입니다." });
  }

  const body = request.body || {};
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 30) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");
  const branch = body.branch;
  const concerns = Array.isArray(body.concerns)
    ? [...new Set(body.concerns.filter((value) => ALLOWED_CONCERNS.has(value)))]
    : [];

  if (body.website) return send(response, 200, { ok: true });

  if (
    !name ||
    name.length > 30 ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 11 ||
    !ALLOWED_BRANCHES.has(branch) ||
    concerns.length === 0 ||
    !isValidPreferredAt(body.preferredAt) ||
    body.consent !== true
  ) {
    return send(response, 400, { ok: false, message: "입력 내용을 다시 확인해 주세요." });
  }

  const notionToken = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID || DATA_SOURCE_ID;

  if (!notionToken) {
    console.error("NOTION_TOKEN is not configured");
    return send(response, 500, { ok: false, message: "현재 신청 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요." });
  }

  try {
    const notionResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2026-03-11",
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: {
          "이름": { title: [{ text: { content: name } }] },
          "연락처": { phone_number: phone },
          "희망지점": { select: { name: branch } },
          "불편한 부위": { multi_select: concerns.map((concern) => ({ name: concern })) },
          "체험 희망시간": { date: { start: body.preferredAt } },
          "비고": { rich_text: [] },
          "등록여부": { checkbox: false },
        },
      }),
    });

    if (!notionResponse.ok) {
      const notionError = await notionResponse.text();
      console.error("Notion lead creation failed", notionResponse.status, notionError);
      return send(response, 502, { ok: false, message: "신청 저장이 지연되고 있습니다. 잠시 후 다시 시도해 주세요." });
    }

    return send(response, 201, { ok: true });
  } catch (error) {
    console.error("Lead API request failed", error);
    return send(response, 500, { ok: false, message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
};
