// ================================================================
// REQUESTOR PAGE LOGIC
// Auth talks to the real backend (server.js). Everything about
// requests themselves (saving, listing, statuses) goes through
// requests-store.js so it's shared with the other persona pages.
// ================================================================

const API_URL = "http://localhost:4000";

let currentStep = 1;
const totalSteps = 3;
let currentRequestFilter = "all";
let editingRequestId = null; // set when reopening a draft

// ----------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------
function showAuthTab(tab) {
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  document.getElementById("login-form").classList.toggle("active", tab === "login");
  document.getElementById("signup-form").classList.toggle("active", tab === "signup");
}

function enterApp(username) {
  const words = username.trim().split(/\s+/);
  const initials = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
  const firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1);

  document.getElementById("user-avatar").textContent = initials;
  document.getElementById("user-name").textContent = firstName;
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("form-wrapper").classList.add("active");

  showDashboard();
}

async function handleLogin() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const errorMsg = document.getElementById("login-error");
  if (!username || !password) {
    errorMsg.textContent = "Please enter your username and password.";
    errorMsg.classList.add("visible");
    return;
  }
  try {
    const response = await fetch(API_URL + "/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) { errorMsg.textContent = data.error; errorMsg.classList.add("visible"); return; }
    errorMsg.classList.remove("visible");
    enterApp(data.username);
  } catch (err) {
    errorMsg.textContent = "Could not reach the server. Is the backend running?";
    errorMsg.classList.add("visible");
  }
}

async function handleSignup() {
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const errorMsg = document.getElementById("signup-error");
  if (!username || !password) {
    errorMsg.textContent = "Please choose a username and password.";
    errorMsg.classList.add("visible");
    return;
  }
  try {
    const response = await fetch(API_URL + "/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) { errorMsg.textContent = data.error; errorMsg.classList.add("visible"); return; }
    errorMsg.classList.remove("visible");
    enterApp(data.username);
  } catch (err) {
    errorMsg.textContent = "Could not reach the server. Is the backend running?";
    errorMsg.classList.add("visible");
  }
}

document.getElementById("loginPassword").addEventListener("keydown", function (e) { if (e.key === "Enter") handleLogin(); });
document.getElementById("loginUsername").addEventListener("keydown", function (e) { if (e.key === "Enter") handleLogin(); });

function handleCancel() {
  if (confirm("Are you sure you want to cancel? Your progress will be lost.")) showDashboard();
}

// ----------------------------------------------------------------
// STEP NAVIGATION
// ----------------------------------------------------------------
function validateCurrentStep() {
  const currentPage = document.getElementById("step-" + currentStep);
  const requiredGroups = currentPage.querySelectorAll(".field-group:has(.required)");
  let allValid = true;
  requiredGroups.forEach(function (group) {
    const input = group.querySelector("input[type='text'], input[type='date'], input[type='number'], textarea, select");
    const radioInputs = group.querySelectorAll("input[type='radio']");
    if (radioInputs.length > 0) {
      const anyChecked = Array.from(radioInputs).some(function (r) { return r.checked; });
      if (!anyChecked) { allValid = false; group.classList.add("field-error"); } else group.classList.remove("field-error");
    } else if (input) {
      if (!input.value || input.value.trim() === "") { allValid = false; input.classList.add("input-error"); } else input.classList.remove("input-error");
    }
  });
  return allValid;
}

function goToStep(stepNumber) {
  document.getElementById("step-" + currentStep).classList.remove("active");
  document.querySelector(".tracker-item[data-step='" + currentStep + "']").classList.remove("active");
  currentStep = stepNumber;
  document.getElementById("step-" + currentStep).classList.add("active");
  document.querySelector(".tracker-item[data-step='" + currentStep + "']").classList.add("active");
  updateFooterButtons();
  if (currentStep === 3) renderReviewSummary();
  document.querySelector(".form-content").scrollTop = 0;
}

function goNext() {
  if (currentStep >= totalSteps) return;
  if (!validateCurrentStep()) return;
  const item = document.querySelector(".tracker-item[data-step='" + currentStep + "']");
  item.classList.add("completed");
  item.querySelector(".tracker-circle").textContent = "✓";
  goToStep(currentStep + 1);
}

function goBack() {
  if (currentStep <= 1) return;
  const targetStep = currentStep - 1;
  const item = document.querySelector(".tracker-item[data-step='" + targetStep + "']");
  item.classList.remove("completed");
  item.querySelector(".tracker-circle").textContent = targetStep;
  goToStep(targetStep);
}

function updateFooterButtons() {
  document.getElementById("btn-back").disabled = (currentStep === 1);
  const nextButton = document.getElementById("btn-next");
  if (currentStep === totalSteps) { nextButton.textContent = "Submit Request"; nextButton.onclick = submitForm; }
  else { nextButton.textContent = "Next"; nextButton.onclick = goNext; }
}

// ----------------------------------------------------------------
// FORM <-> REQUEST OBJECT
// ----------------------------------------------------------------
function getFieldValue(id) {
  const el = document.getElementById(id);
  return el && el.value ? el.value : "";
}
function getCheckedRadioValue(name) {
  const checked = document.querySelector("input[name='" + name + "']:checked");
  return checked ? checked.value : "";
}

function collectFormDataAsRequest(id) {
  return {
    id: id,
    title: getFieldValue("requestTitle") || "Untitled Request",
    category: getFieldValue("requestCategory"),
    priority: getCheckedRadioValue("priority") || "—",
    requiredByDate: getFieldValue("requiredByDate"),
    businessJustification: getFieldValue("businessJustification"),
    businessUnit: getFieldValue("businessUnit"),
    department: getFieldValue("department"),
    subaccountName: getFieldValue("subaccountName"),
    parentGlobalAccount: getFieldValue("parentGlobalAccount"),
    region: getFieldValue("region"),
    businessOwner: getFieldValue("businessOwner"),
    environment: getCheckedRadioValue("environment"),
    estimatedUsers: getFieldValue("estimatedUsers")
  };
}

function renderReviewSummary() {
  const draft = collectFormDataAsRequest(editingRequestId || document.getElementById("requestIdDisplay").textContent);
  let html = renderRequestDetailsCard(draft);
  html += '<div class="review-approval-note"><span class="info-icon-circle">i</span><span>Once submitted, this request will be routed to the Assessor for initial review.</span></div>';
  document.getElementById("review-summary").innerHTML = html;
}

function submitForm() {
  const id = editingRequestId || document.getElementById("requestIdDisplay").textContent;
  const formData = collectFormDataAsRequest(id);
  const existing = getRequestById(id);

  const request = Object.assign({
    requestedBy: document.getElementById("user-name").textContent || "Requestor",
    createdOn: todayLabel(),
    status: "pending",
    currentPersona: "assessor",
    stages: newStagesBlock(),
    comments: [],
    attachments: []
  }, existing || {}, formData, { status: "pending", currentPersona: "assessor" });

  saveRequest(request);
  alert("Your service request " + id + " has been submitted and routed to the Assessor.");
  editingRequestId = null;
  showDashboard();
}

function handleSaveDraft() {
  const id = editingRequestId || document.getElementById("requestIdDisplay").textContent;
  const formData = collectFormDataAsRequest(id);
  const existing = getRequestById(id);

  const request = Object.assign({
    requestedBy: document.getElementById("user-name").textContent || "Requestor",
    createdOn: todayLabel(),
    status: "draft",
    currentPersona: "assessor",
    stages: newStagesBlock(),
    comments: [],
    attachments: []
  }, existing || {}, formData, { status: "draft" });

  saveRequest(request);
  alert("Saved as draft (" + id + ").");
  editingRequestId = null;
  showDashboard();
}

// ----------------------------------------------------------------
// NAV — Dashboard / New Request
// ----------------------------------------------------------------
function showDashboard() {
  document.getElementById("app-nav").classList.remove("hidden");
  document.getElementById("step-tracker").classList.add("hidden");
  document.getElementById("dashboard-view").classList.add("active");
  document.getElementById("new-request-view").classList.remove("active");
  document.getElementById("nav-dashboard").classList.add("active");
  document.getElementById("nav-new-request").classList.remove("active");
  document.getElementById("page-title").textContent = "Dashboard";
  document.getElementById("page-subtitle").textContent = "Overview of your service requests";
  document.getElementById("btn-cancel").style.display = "none";
  document.getElementById("form-footer").style.display = "none";
  renderDashboard();
}

function showNewRequestForm() {
  resetRequestForm();
  document.getElementById("app-nav").classList.add("hidden");
  document.getElementById("step-tracker").classList.remove("hidden");
  document.getElementById("dashboard-view").classList.remove("active");
  document.getElementById("new-request-view").classList.add("active");
  document.getElementById("nav-dashboard").classList.remove("active");
  document.getElementById("nav-new-request").classList.add("active");
  document.getElementById("page-title").textContent = "New Service Request";
  document.getElementById("page-subtitle").textContent = "Raise a request for BTP Infrastructure, Entitlements or Access";
  document.getElementById("btn-cancel").style.display = "inline-block";
  document.getElementById("form-footer").style.display = "flex";
}

function resetRequestForm() {
  const view = document.getElementById("new-request-view");
  view.querySelectorAll("input[type='text'], input[type='number'], input[type='date'], textarea").forEach(function (f) { f.value = ""; f.classList.remove("input-error"); });
  view.querySelectorAll("select").forEach(function (s) { s.selectedIndex = 0; });
  view.querySelectorAll("input[type='radio']").forEach(function (r) { r.checked = false; });
  view.querySelectorAll(".field-error").forEach(function (g) { g.classList.remove("field-error"); });
  view.querySelectorAll(".form-page").forEach(function (p) { p.classList.remove("active"); });
  document.getElementById("step-1").classList.add("active");

  document.querySelectorAll(".tracker-item").forEach(function (item) {
    item.classList.remove("completed", "active");
    item.querySelector(".tracker-circle").textContent = item.getAttribute("data-step");
  });
  document.querySelector(".tracker-item[data-step='1']").classList.add("active");

  editingRequestId = null;
  document.getElementById("requestIdDisplay").textContent = generateRequestId();
  currentStep = 1;
  updateFooterButtons();
}

// Reopen a saved draft for editing
function openDraft(id) {
  const r = getRequestById(id);
  if (!r) return;
  editingRequestId = id;

  document.getElementById("app-nav").classList.add("hidden");
  document.getElementById("step-tracker").classList.remove("hidden");
  document.getElementById("dashboard-view").classList.remove("active");
  document.getElementById("new-request-view").classList.add("active");
  document.getElementById("page-title").textContent = "Edit Draft Request";
  document.getElementById("page-subtitle").textContent = r.id;
  document.getElementById("btn-cancel").style.display = "inline-block";
  document.getElementById("form-footer").style.display = "flex";

  document.getElementById("requestIdDisplay").textContent = r.id;
  document.getElementById("requestCategory").value = r.category || "";
  document.getElementById("requestTitle").value = r.title || "";
  document.getElementById("requiredByDate").value = r.requiredByDate || "";
  document.getElementById("businessJustification").value = r.businessJustification || "";
  document.getElementById("businessUnit").value = r.businessUnit || "";
  document.getElementById("department").value = r.department || "";
  document.getElementById("subaccountName").value = r.subaccountName || "";
  document.getElementById("parentGlobalAccount").value = r.parentGlobalAccount || "";
  document.getElementById("region").value = r.region || "";
  document.getElementById("businessOwner").value = r.businessOwner || "";
  document.getElementById("estimatedUsers").value = r.estimatedUsers || "";
  if (r.priority) { const el = document.querySelector("input[name='priority'][value='" + r.priority + "']"); if (el) el.checked = true; }
  if (r.environment) { const el = document.querySelector("input[name='environment'][value='" + r.environment + "']"); if (el) el.checked = true; }

  currentStep = 1;
  document.querySelectorAll(".form-page").forEach(function (p) { p.classList.remove("active"); });
  document.getElementById("step-1").classList.add("active");
  document.querySelectorAll(".tracker-item").forEach(function (item) { item.classList.remove("active", "completed"); });
  document.querySelector(".tracker-item[data-step='1']").classList.add("active");
  updateFooterButtons();
}

// ----------------------------------------------------------------
// DASHBOARD — counts + list (reads from the shared store)
// ----------------------------------------------------------------
function renderDashboard() {
  const all = loadRequests();
  const counts = { all: all.length, pending: 0, "in-progress": 0, approved: 0, rejected: 0, draft: 0 };
  all.forEach(function (r) { if (counts[r.status] !== undefined) counts[r.status]++; });

  document.getElementById("count-all").textContent = counts.all;
  document.getElementById("count-pending").textContent = counts.pending;
  document.getElementById("count-inprogress").textContent = counts["in-progress"];
  document.getElementById("count-approved").textContent = counts.approved;
  document.getElementById("count-rejected").textContent = counts.rejected;
  document.getElementById("count-draft").textContent = counts.draft;

  renderRequestsList();
}

function filterRequests(status) {
  currentRequestFilter = status;
  document.querySelectorAll(".dash-card").forEach(function (c) { c.classList.toggle("active-filter", c.getAttribute("data-filter") === status); });
  const labelMap = { all: "Showing all", pending: "Showing pending", "in-progress": "Showing in progress", approved: "Showing approved", rejected: "Showing rejected", draft: "Showing drafts" };
  const label = document.getElementById("active-filter-label");
  label.textContent = labelMap[status];
  label.className = "requests-filter-label" + (status !== "all" ? " filter-label--" + status : "");
  renderRequestsList();
}

function renderRequestsList() {
  const list = document.getElementById("requests-list");
  const all = loadRequests();
  const sorted = all.slice().sort(function (a, b) { return new Date(b.requiredByDate) - new Date(a.requiredByDate); });
  const filtered = currentRequestFilter === "all" ? sorted : sorted.filter(function (r) { return r.status === currentRequestFilter; });

  if (filtered.length === 0) { list.innerHTML = "<li class='empty-state'>No requests found for this filter.</li>"; return; }

  let html = "";
  filtered.forEach(function (r) {
    const clickable = r.status === "draft";
    html += "<li class='request-row" + (clickable ? " request-row--clickable" : "") + "'" + (clickable ? " onclick=\"openDraft('" + r.id + "')\"" : "") + ">";
    html += "<span class='request-meta' style='width:120px; font-weight:600; color:#22242a;'>" + r.id + "</span>";
    html += "<div class='request-info'><span class='request-title'>" + r.title + "</span><span class='request-meta'>" + (CATEGORY_LABELS[r.category] || r.category || "—") + "</span></div>";
    html += "<span class='request-priority priority--" + r.priority + "'>" + r.priority + "</span>";
    html += "<span class='request-due-date'>&#128197; " + (r.requiredByDate || "—") + "</span>";
    html += "<span class='status-cell'><span class='status-badge status-badge--" + r.status + "'>" + r.status.replace("-", " ") + "</span></span>";
    html += "</li>";
  });
  list.innerHTML = html;
}

updateFooterButtons();
