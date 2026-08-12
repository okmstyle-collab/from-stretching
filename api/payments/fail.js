const {
  findLeadByOrderId,
  isValidOrderId,
  send,
  updateNotionPage,
} = require("../_paymentShared");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { ok: false, message: "지원하지 않는 요청입니다." });
  }

  const orderId = typeof request.body?.orderId === "string" ? request.body.orderId : "";
  const code = typeof request.body?.code === "string" ? request.body.code : "";

  if (!orderId || !isValidOrderId(orderId)) {
    return send(response, 200, { ok: true });
  }

  try {
    const leadPage = await findLeadByOrderId(orderId);

    if (leadPage) {
      await updateNotionPage(leadPage.id, {
        "결제상태": {
          select: { name: code === "PAY_PROCESS_CANCELED" ? "결제취소" : "결제실패" },
        },
      });
    }

    return send(response, 200, { ok: true });
  } catch (error) {
    console.error("Payment fail logging failed", error);
    return send(response, 200, { ok: true });
  }
};
