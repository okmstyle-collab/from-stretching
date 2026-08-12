const {
  RESERVATION_AMOUNT,
  findLeadByOrderId,
  getLeadSummary,
  getTossBasicAuth,
  isValidOrderId,
  send,
  updateNotionPage,
} = require("../_paymentShared");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { ok: false, message: "지원하지 않는 요청입니다." });
  }

  const paymentKey = typeof request.body?.paymentKey === "string" ? request.body.paymentKey : "";
  const orderId = typeof request.body?.orderId === "string" ? request.body.orderId : "";
  const amount = Number(request.body?.amount);

  if (!paymentKey || !isValidOrderId(orderId) || amount !== RESERVATION_AMOUNT) {
    return send(response, 400, { ok: false, message: "결제 정보가 올바르지 않습니다." });
  }

  try {
    const leadPage = await findLeadByOrderId(orderId);

    if (!leadPage) {
      return send(response, 404, { ok: false, message: "결제와 연결된 신청 정보를 찾지 못했습니다." });
    }

    const lead = getLeadSummary(leadPage);

    if (lead.paymentStatus === "결제완료" && lead.paymentKey === paymentKey) {
      return send(response, 200, { ok: true, alreadyConfirmed: true });
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: getTossBasicAuth(),
        "Content-Type": "application/json",
        "Idempotency-Key": orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount: RESERVATION_AMOUNT }),
    });
    const tossPayment = await tossResponse.json().catch(() => ({}));

    if (!tossResponse.ok) {
      console.error("Toss payment confirm failed", tossResponse.status, tossPayment);
      await updateNotionPage(lead.id, {
        "결제상태": { select: { name: "결제실패" } },
        "결제키": { rich_text: [{ text: { content: paymentKey.slice(0, 200) } }] },
      });
      return send(response, 502, {
        ok: false,
        message: tossPayment.message || "결제 승인에 실패했습니다.",
      });
    }

    await updateNotionPage(lead.id, {
      "결제상태": { select: { name: "결제완료" } },
      "결제금액": { number: RESERVATION_AMOUNT },
      "주문번호": { rich_text: [{ text: { content: orderId } }] },
      "결제키": { rich_text: [{ text: { content: paymentKey.slice(0, 200) } }] },
      "결제일시": { date: { start: tossPayment.approvedAt || new Date().toISOString() } },
    });

    return send(response, 200, {
      ok: true,
      method: tossPayment.method,
      receiptUrl: tossPayment.receipt?.url || "",
      approvedAt: tossPayment.approvedAt || "",
    });
  } catch (error) {
    console.error("Payment confirm failed", error);
    return send(response, 500, { ok: false, message: "결제 확인 중 오류가 발생했습니다." });
  }
};
