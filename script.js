const form = document.querySelector("#trial-form");
const formCard = document.querySelector(".lead-modal-shell");
const formMessage = document.querySelector("#form-message");
const successPanel = document.querySelector("#form-success");
const submitAnother = document.querySelector("#submit-another");
const phoneInput = document.querySelector("#lead-phone");
const dateInput = document.querySelector("#lead-date");
const datePickerButton = document.querySelector(".date-picker-button");
const timeInput = document.querySelector("#lead-time");
const leadModal = document.querySelector("#lead-form");
const modalClose = document.querySelector("[data-modal-close]");

const allowedBranches = new Set(["송도점", "작전점", "부평점"]);
const allowedConcerns = new Set(["목", "어깨", "등", "허리", "골반", "기타"]);

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

dateInput.addEventListener("change", updateDateButton);

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
  const phone = String(data.get("phone") || "").replace(/\D/g, "");
  const name = String(data.get("name") || "").trim();
  const date = String(data.get("date") || "");
  const time = String(data.get("time") || "");
  const consent = data.get("consent") === "on";
  const preferredAt = new Date(`${date}T${time}:00+09:00`);
  const isWholeHour = /^(09|1[0-9]|2[0-3]):00$/.test(time);

  if (
    !name ||
    phone.length < 10 ||
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
        branch,
        concerns,
        preferredAt: preferredAt.toISOString(),
        consent,
        website: String(data.get("website") || ""),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "신청을 저장하지 못했습니다.");

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

submitAnother.addEventListener("click", () => {
  form.reset();
  dateInput.min = localDateString(new Date());
  updateDateButton();
  timeInput.value = "";
  successPanel.hidden = true;
  form.hidden = false;
  clearMessage();
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
