const form = document.querySelector("#trial-form");
const formCard = document.querySelector(".lead-modal-shell");
const formMessage = document.querySelector("#form-message");
const successPanel = document.querySelector("#form-success");
const submitAnother = document.querySelector("#submit-another");
const payReservation = document.querySelector("#pay-reservation");
const paymentMessage = document.querySelector("#payment-message");
const paymentWidgetArea = document.querySelector("#payment-widget-area");
const paymentMethods = document.querySelector("#payment-methods");
const paymentAgreement = document.querySelector("#payment-agreement");
const phoneInput = document.querySelector("#lead-phone");
const dateInput = document.querySelector("#lead-date");
const datePickerButton = document.querySelector(".date-picker-button");
const timeInput = document.querySelector("#lead-time");
const leadModal = document.querySelector("#lead-form");
const modalClose = document.querySelector("[data-modal-close]");

const allowedBranches = new Set(["송도점", "작전점", "부평점"]);
const allowedGenders = new Set(["남성", "여성"]);
const allowedConcerns = new Set(["목", "어깨", "등", "허리", "골반", "무릎", "발(발목)", "기타"]);
let currentLeadId = "";
let reservationWidgets = null;
let reservationPayment = null;
let reservationWidgetReady = false;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekendDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatSelectedDate(value) {
  if (!value) return "날짜를 선택해 주세요";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function updateDateButton() {
  const display = document.querySelector("#lead-date-display");
  display.textContent = formatSelectedDate(dateInput.value);
  datePickerButton.classList.toggle("has-value", Boolean(dateInput.value));
}

function openDatePicker() {
  dateInput.focus({ preventScroll: true });

  if (typeof dateInput.showPicker === "function") {
    try {
      dateInput.showPicker();
      return;
    } catch (error) {
      // Older mobile browsers may expose showPicker without allowing it.
    }
  }

  dateInput.click();
}

function selectBranch(branch) {
  if (!allowedBranches.has(branch)) return;
  const option = form.querySelector(`input[name="branch"][value="${branch}"]`);
  if (option) option.checked = true;
}

function setMessage(message, type = "error") {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

function clearMessage() {
  formMessage.textContent = "";
  delete formMessage.dataset.type;
}

function setPaymentMessage(message, type = "error") {
  paymentMessage.textContent = message;
  paymentMessage.dataset.type = type;
}

function clearPaymentMessage() {
  paymentMessage.textContent = "";
  delete paymentMessage.dataset.type;
}

function openLeadModal(branch) {
  selectBranch(branch);
  if (!leadModal.open) leadModal.showModal();
  document.body.classList.add("modal-open");
  window.history.replaceState(null, "", "#lead-form");
  window.setTimeout(() => document.querySelector("#lead-name")?.focus(), 80);
}

function closeLeadModal() {
  if (leadModal.open) leadModal.close();
}

dateInput.min = localDateString(new Date());
updateDateButton();

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

dateInput.addEventListener("change", () => {
  if (isWeekendDate(dateInput.value)) {
    dateInput.value = "";
    dateInput.setAttribute("aria-invalid", "true");
    datePickerButton.classList.add("is-invalid");
    updateDateButton();
    window.setTimeout(() => setMessage("토요일과 일요일은 예약할 수 없습니다. 평일을 선택해 주세요."), 0);
    return;
  }

  dateInput.removeAttribute("aria-invalid");
  datePickerButton.classList.remove("is-invalid");
  updateDateButton();
});

datePickerButton.addEventListener("click", (event) => {
  if (event.target === dateInput) return;
  event.preventDefault();
  openDatePicker();
});

datePickerButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openDatePicker();
});

document.querySelectorAll("[data-lead-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openLeadModal(trigger.dataset.branch);
  });
});

modalClose.addEventListener("click", closeLeadModal);

leadModal.addEventListener("click", (event) => {
  if (event.target === leadModal) closeLeadModal();
});

leadModal.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  if (window.location.hash === "#lead-form") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
});

if (window.location.hash === "#lead-form") openLeadModal();

form.addEventListener("input", clearMessage);
form.addEventListener("change", clearMessage);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const data = new FormData(form);
  const concerns = data.getAll("concerns").filter((value) => allowedConcerns.has(value));
  const branch = data.get("branch");
  const gender = data.get("gender");
  const phone = String(data.get("phone") || "").replace(/\D/g, "");
  const name = String(data.get("name") || "").trim();
  const date = String(data.get("date") || "");
  const time = String(data.get("time") || "");
  const consent = data.get("consent") === "on";
  const preferredAt = new Date(`${date}T${time}:00+09:00`);
  const isWholeHour = /^(09|1[0-9]|2[0-3]):00$/.test(time);

  if (isWeekendDate(date)) {
    dateInput.setAttribute("aria-invalid", "true");
    datePickerButton.classList.add("is-invalid");
    setMessage("토요일과 일요일은 예약할 수 없습니다. 평일을 선택해 주세요.");
    datePickerButton.focus();
    return;
  }

  if (
    !name ||
    phone.length < 10 ||
    !allowedGenders.has(gender) ||
    !allowedBranches.has(branch) ||
    concerns.length === 0 ||
    !date ||
    !isWholeHour ||
    Number.isNaN(preferredAt.getTime()) ||
    preferredAt.getTime() <= Date.now() ||
    !consent
  ) {
    setMessage("필수 항목을 모두 확인해 주세요.");
    form.querySelector(":invalid")?.focus();
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  form.classList.add("is-submitting");

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: formatPhone(phone),
        gender,
        branch,
        concerns,
        preferredAt: preferredAt.toISOString(),
        consent,
        website: String(data.get("website") || ""),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "신청을 저장하지 못했습니다.");

    currentLeadId = result.leadId || "";
    payReservation.disabled = !currentLeadId;
    clearPaymentMessage();
    if (!currentLeadId) {
      setPaymentMessage("신청은 저장되었지만 결제 연결 정보가 없습니다. 담당자 연락을 기다려 주세요.");
    }

    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
  } catch (error) {
    setMessage(error.message || "잠시 후 다시 시도해 주세요.");
  } finally {
    submitButton.disabled = false;
    form.classList.remove("is-submitting");
  }
});

payReservation.addEventListener("click", async () => {
  if (!currentLeadId) {
    setPaymentMessage("신청 정보를 찾지 못했습니다. 다시 신청해 주세요.");
    return;
  }

  payReservation.disabled = true;
  payReservation.classList.add("is-loading");
  clearPaymentMessage();

  try {
    if (!reservationWidgetReady) {
      const response = await fetch("/api/payments/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: currentLeadId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "결제를 준비하지 못했습니다.");

      if (typeof TossPayments !== "function") {
        throw new Error("결제창을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      }

      const tossPayments = TossPayments(result.clientKey);
      reservationWidgets = tossPayments.widgets({ customerKey: result.customerKey });
      reservationPayment = result.payment;
      await reservationWidgets.setAmount(result.amount);

      paymentWidgetArea.hidden = false;
      await reservationWidgets.renderPaymentMethods({ selector: "#payment-methods", amount: result.amount });
      await reservationWidgets.renderAgreement({ selector: "#payment-agreement" });

      reservationWidgetReady = true;
      payReservation.classList.remove("is-loading");
      payReservation.querySelector(".payment-button-label").textContent = "선택한 결제수단으로 10,000원 결제하기";
      setPaymentMessage("결제수단을 선택한 뒤 아래 버튼을 한 번 더 눌러 주세요.", "success");
      paymentWidgetArea.scrollIntoView({ behavior: "smooth", block: "center" });
      payReservation.disabled = false;
      return;
    }

    await reservationWidgets.requestPayment(reservationPayment);
  } catch (error) {
    if (!reservationWidgetReady) {
      reservationWidgets = null;
      reservationPayment = null;
      paymentWidgetArea.hidden = true;
      paymentMethods.innerHTML = "";
      paymentAgreement.innerHTML = "";
    }

    payReservation.disabled = false;
    payReservation.classList.remove("is-loading");
    setPaymentMessage(error.message || "결제 준비 중 오류가 발생했습니다.");
  }
});

submitAnother.addEventListener("click", () => {
  form.reset();
  currentLeadId = "";
  reservationWidgets = null;
  reservationPayment = null;
  reservationWidgetReady = false;
  payReservation.disabled = true;
  payReservation.classList.remove("is-loading");
  payReservation.querySelector(".payment-button-label").textContent = "체험 예약금 10,000원 결제하기";
  paymentWidgetArea.hidden = true;
  paymentMethods.innerHTML = "";
  paymentAgreement.innerHTML = "";
  dateInput.min = localDateString(new Date());
  dateInput.removeAttribute("aria-invalid");
  datePickerButton.classList.remove("is-invalid");
  updateDateButton();
  timeInput.value = "";
  successPanel.hidden = true;
  form.hidden = false;
  clearMessage();
  clearPaymentMessage();
  document.querySelector("#lead-name")?.focus();
  formCard.scrollTo({ top: 0, behavior: "smooth" });
});

const heroVideo = document.querySelector(".hero-video");
let heroReplayTimer;

heroVideo?.addEventListener("ended", () => {
  window.clearTimeout(heroReplayTimer);
  heroReplayTimer = window.setTimeout(() => {
    heroVideo.currentTime = 0;
    heroVideo.play().catch(() => {});
  }, 2000);
});
