const pageType = document.body.dataset.paymentResult;
const params = new URLSearchParams(window.location.search);
const resultIcon = document.querySelector("#payment-result-icon");
const resultTitle = document.querySelector("#payment-result-title");
const resultCopy = document.querySelector("#payment-result-copy");
const resultDetail = document.querySelector("#payment-result-detail");
const resultAction = document.querySelector("#payment-result-action");

function setResult({ icon, iconClass, title, copy, detail, actionHref, actionText }) {
  resultIcon.textContent = icon;
  resultIcon.className = `payment-result-icon ${iconClass}`;
  resultTitle.textContent = title;
  resultCopy.textContent = copy;
  resultDetail.textContent = detail;

  if (actionHref) resultAction.href = actionHref;
  if (actionText) resultAction.textContent = actionText;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(result.message || "처리 중 오류가 발생했습니다.");
  return result;
}

async function confirmPayment() {
  const paymentKey = params.get("paymentKey") || "";
  const orderId = params.get("orderId") || "";
  const amount = Number(params.get("amount"));

  if (!paymentKey || !orderId || amount !== 10000) {
    setResult({
      icon: "!",
      iconClass: "is-fail",
      title: "결제 정보가 올바르지 않습니다.",
      copy: "신청 정보와 결제 금액을 다시 확인해 주세요.",
      detail: "예약금은 10,000원으로만 승인됩니다.",
      actionHref: "/#lead-form",
      actionText: "다시 신청하기",
    });
    return;
  }

  try {
    const result = await postJson("/api/payments/confirm", { paymentKey, orderId, amount });
    const receiptText = result.receiptUrl ? "영수증은 결제사 화면에서 확인할 수 있습니다." : "담당자가 곧 일정을 확인해 드립니다.";

    setResult({
      icon: "✓",
      iconClass: "is-success",
      title: "예약금 결제가 완료되었습니다.",
      copy: "무료 체험 신청과 예약금 결제가 정상 접수되었습니다.",
      detail: receiptText,
      actionHref: "/",
      actionText: "홈으로 돌아가기",
    });
  } catch (error) {
    setResult({
      icon: "!",
      iconClass: "is-fail",
      title: "결제 승인 확인이 필요합니다.",
      copy: "결제는 시도되었지만 승인 확인 중 문제가 발생했습니다.",
      detail: error.message || "담당자에게 문의해 주세요.",
      actionHref: "/#lead-form",
      actionText: "다시 신청하기",
    });
  }
}

async function logPaymentFail() {
  const code = params.get("code") || "";
  const message = params.get("message") || "결제가 취소되었거나 완료되지 않았습니다.";
  const orderId = params.get("orderId") || "";

  if (orderId) {
    await postJson("/api/payments/fail", { code, orderId }).catch(() => {});
  }

  setResult({
    icon: "!",
    iconClass: "is-fail",
    title: code === "PAY_PROCESS_CANCELED" ? "결제가 취소되었습니다." : "예약금 결제가 완료되지 않았습니다.",
    copy: "신청 정보는 접수되었을 수 있습니다. 예약금 결제가 필요하면 다시 진행해 주세요.",
    detail: message,
    actionHref: "/#lead-form",
    actionText: "다시 신청하기",
  });
}

if (pageType === "success") {
  confirmPayment();
} else {
  logPaymentFail();
}
