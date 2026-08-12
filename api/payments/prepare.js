const {
  RESERVATION_AMOUNT,
  RESERVATION_ORDER_NAME,
  createOrderId,
  getLeadSummary,
  getNotionPage,
  getOrigin,
  normalizePhone,
  send,
  updateNotionPage,
} = require("../_paymentShared");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { ok: false, message: "지원하지 않는 요청입니다." });
  }

  const clientKey = process.env.TOSS_CLIENT_KEY;

  if (!clientKey || !process.env.TOSS_SECRET_KEY) {
    return send(response, 500, {
      ok: false,
      message: "토스페이먼츠 결제 키가 아직 등록되지 않았습니다.",
    });
  }

  const leadId = typeof request.body?.leadId === "string" ? request.body.leadId : "";

  if (!leadId) {
    return send(response, 400, { ok: false, message: "신청 정보를 찾지 못했습니다." });
  }

  try {
    const leadPage = await getNotionPage(leadId);

    if (!leadPage) {
      return send(response, 404, { ok: false, message: "신청 정보를 찾지 못했습니다." });
    }

    const lead = getLeadSummary(leadPage);
    const orderId = createOrderId();
    const origin = getOrigin(request);
    const customerMobilePhone = normalizePhone(lead.phone);

    await updateNotionPage(leadId, {
      "결제상태": { select: { name: "결제대기" } },
      "결제금액": { number: RESERVATION_AMOUNT },
      "주문번호": { rich_text: [{ text: { content: orderId } }] },
    });

    return send(response, 200, {
      ok: true,
      clientKey,
      customerKey: `from_stretching_${leadId.replace(/-/g, "").slice(0, 24)}`,
      amount: {
        currency: "KRW",
        value: RESERVATION_AMOUNT,
      },
      payment: {
        orderId,
        orderName: RESERVATION_ORDER_NAME,
        successUrl: `${origin}/payment-success.html`,
        failUrl: `${origin}/payment-fail.html`,
        customerName: lead.name,
        customerMobilePhone,
      },
    });
  } catch (error) {
    console.error("Payment prepare failed", error);
    return send(response, 500, { ok: false, message: "결제 준비 중 오류가 발생했습니다." });
  }
};
