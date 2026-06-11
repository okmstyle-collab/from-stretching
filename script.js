const form = document.querySelector("#trial-form");
const formCard = document.querySelector(".lead-form-card");
const formMessage = document.querySelector("#form-message");
const successPanel = document.querySelector("#form-success");
const submitAnother = document.querySelector("#submit-another");
const phoneInput = document.querySelector("#lead-phone");
const dateInput = document.querySelector("#lead-date");
const leadSection = document.querySelector("#lead-form");

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

dateInput.min = localDateString(new Date());

if ("IntersectionObserver" in window) {
  const leadObserver = new IntersectionObserver(
    ([entry]) => document.body.classList.toggle("lead-form-visible", entry.isIntersecting),
    { threshold: 0.08 },
  );
  leadObserver.observe(leadSection);
}

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

document.querySelectorAll("[data-lead-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    selectBranch(trigger.dataset.branch);
    leadSection.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", "#lead-form");
    window.setTimeout(() => document.querySelector("#lead-name")?.focus({ preventScroll: true }), 700);
  });
});

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

  if (
    !name ||
    phone.length < 10 ||
    !allowedBranches.has(branch) ||
    concerns.length === 0 ||
    !date ||
    !time ||
    Number.isNaN(preferredAt.getTime()) ||
    preferredAt.getTime() < Date.now() - 60 * 60 * 1000 ||
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
    successPanel.focus?.();
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
  successPanel.hidden = true;
  form.hidden = false;
  clearMessage();
  document.querySelector("#lead-name")?.focus();
  formCard.scrollIntoView({ behavior: "smooth", block: "center" });
});
