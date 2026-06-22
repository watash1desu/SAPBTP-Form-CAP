const PERSONA_KEY = "assessor";
let dashFilter = "all";
let activeQueueId = null;

function showDashboard() {
  setActivePage("dashboard-view", "nav-dashboard");
  document.getElementById("page-title").textContent = "Dashboard";
  document.getElementById("page-subtitle").textContent = "Overview of all service requests";
  renderDashboard();
  updateQueueCount();
}

function showQueue() {
  setActivePage("queue-view", "nav-queue");
  document.getElementById("page-title").textContent = "My Queue";
  document.getElementById("page-subtitle").textContent = "Requests pending your action";
  activeQueueId = null;
  renderQueueList();
  document.getElementById("queue-detail-panel").innerHTML = '<div class="queue-detail-placeholder">Select a request from the list to review it.</div>';
}

function setActivePage(pageId, navId) {
  document.querySelectorAll(".app-page").forEach(function (p) { p.classList.remove("active"); });
  document.getElementById(pageId).classList.add("active");
  document.querySelectorAll(".app-nav-item").forEach(function (n) { n.classList.remove("active"); });
  document.getElementById(navId).classList.add("active");
}

function updateQueueCount() {
  const myQueue = loadRequests().filter(function (r) { return r.currentPersona === PERSONA_KEY && r.status !== "rejected" && r.status !== "approved"; });
  document.getElementById("queue-count").textContent = myQueue.length;
}

// ---------------- DASHBOARD ----------------
function filterDashboard(status) {
  dashFilter = status;
  document.querySelectorAll(".dash-card").forEach(function (c) { c.classList.toggle("active-filter", c.getAttribute("data-filter") === status); });
  document.getElementById("active-filter-label").textContent = status === "all" ? "Showing all" : "Showing " + status.replace("-", " ");
  renderDashboard();
}

function renderDashboard() {
  const all = loadRequests();
  const counts = { all: all.length, pending: 0, "in-progress": 0, approved: 0, rejected: 0 };
  all.forEach(function (r) { if (counts[r.status] !== undefined) counts[r.status]++; });
  document.getElementById("count-all").textContent = counts.all;
  document.getElementById("count-pending").textContent = counts.pending;
  document.getElementById("count-inprogress").textContent = counts["in-progress"];
  document.getElementById("count-approved").textContent = counts.approved;
  document.getElementById("count-rejected").textContent = counts.rejected;

  const filtered = dashFilter === "all" ? all : all.filter(function (r) { return r.status === dashFilter; });
  const list = document.getElementById("requests-list");
  if (filtered.length === 0) { list.innerHTML = "<li class='empty-state'>No requests found.</li>"; return; }

  let html = "";
  filtered.forEach(function (r) {
    html += "<li class='request-row request-row--clickable' onclick=\"openReadOnlyDetail('" + r.id + "')\">";
    html += "<span class='request-meta' style='width:120px; font-weight:600; color:#22242a;'>" + r.id + "</span>";
    html += "<div class='request-info'><span class='request-title'>" + r.title + "</span><span class='request-meta'>" + (CATEGORY_LABELS[r.category] || "—") + "</span></div>";
    html += "<span class='request-priority priority--" + r.priority + "'>" + r.priority + "</span>";
    html += "<span class='request-due-date'>&#128197; " + r.requiredByDate + "</span>";
    html += "<span class='status-cell'><span class='status-badge status-badge--" + r.status + "'>" + r.status.replace("-", " ") + "</span></span>";
    html += "</li>";
  });
  list.innerHTML = html;
}

function openReadOnlyDetail(id) {
  const r = getRequestById(id);
  if (!r) return;
  setActivePage("detail-view", "nav-dashboard");
  document.getElementById("detail-readonly-content").innerHTML = buildDetailHeader(r) + renderStepper(r) + renderCommentsAndAttachments(r) + '<div class="review-cards">' + renderRequestDetailsCard(r) + '</div>';
}

// ---------------- MY QUEUE ----------------
function renderQueueList() {
  const myQueue = loadRequests().filter(function (r) { return r.currentPersona === PERSONA_KEY && r.status !== "rejected" && r.status !== "approved"; });
  document.getElementById("queue-list-count").textContent = myQueue.length;
  updateQueueCount();
  const listEl = document.getElementById("queue-card-list");

  if (myQueue.length === 0) { listEl.innerHTML = "<li class='empty-state'>Nothing pending your action right now.</li>"; return; }

  let html = "";
  myQueue.forEach(function (r) {
    html += "<li class='queue-card" + (r.id === activeQueueId ? " active" : "") + "' onclick=\"openQueueItem('" + r.id + "')\">";
    html += "<div class='queue-card-top'><div><div class='queue-card-title'>" + r.title + "</div><div class='queue-card-id'>" + r.id + "</div></div>";
    html += "<span class='priority-tag priority-tag--" + r.priority + "'>" + r.priority + "</span></div>";
    html += "<div class='queue-card-meta'><span>" + r.requestedBy + "</span><span>Due " + r.requiredByDate + "</span></div>";
    html += "</li>";
  });
  listEl.innerHTML = html;
}

function openQueueItem(id) {
  activeQueueId = id;
  renderQueueList();
  const r = getRequestById(id);
  // Step 1: view-only request details
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    '<div class="review-banner">Review the request details below before proceeding.</div>' +
    '<div class="review-cards" style="margin-bottom:16px;">' + renderRequestDetailsCard(r) + '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn-primary" onclick="openAssessorActionStep(\'' + id + '\')">Next &#8594;</button>' +
    '</div>';
}

function openAssessorActionStep(id) {
  activeQueueId = id;
  const r = getRequestById(id);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    renderStepper(r) +
    renderCommentsAndAttachments(r) +
    buildAssessorActionPanel();
}

function buildDetailHeader(r) {
  return (
    '<div class="detail-header">' +
      '<div class="detail-header-top"><span class="detail-title">' + r.title + '</span><span class="priority-tag priority-tag--' + r.priority + '">' + r.priority + '</span></div>' +
      '<div class="detail-id-row"><span>' + r.id + '</span><span>Requested by ' + r.requestedBy + '</span><span>Due ' + r.requiredByDate + '</span><span>Created ' + r.createdOn + '</span></div>' +
    '</div>'
  );
}

function buildAssessorActionPanel() {
  return (
    '<div class="action-panel">' +
      '<div class="action-panel-title">Your Action</div>' +
      '<div class="field-group">' +
        '<label class="field-label">Does this request have cost implications? <span class="required">*</span></label>' +
        '<div class="radio-group">' +
          '<label class="radio-option"><input type="radio" name="assessorCostImpact" value="yes"> Yes</label>' +
          '<label class="radio-option"><input type="radio" name="assessorCostImpact" value="no"> No</label>' +
        '</div>' +
      '</div>' +
      '<div class="field-group">' +
        '<label class="field-label">Comments and Remarks</label>' +
        '<textarea class="field-textarea" id="assessorComment" rows="2" placeholder="Add any notes for the next reviewer"></textarea>' +
      '</div>' +
      '<div class="action-panel-buttons"><button class="btn-primary" onclick="submitAssessorDecision()">Submit Decision</button></div>' +
    '</div>'
  );
}

function submitAssessorDecision() {
  const choice = document.querySelector("input[name='assessorCostImpact']:checked");
  if (!choice) { alert("Please select Yes or No before submitting."); return; }
  const comment = document.getElementById("assessorComment").value;
  const r = getRequestById(activeQueueId);

  r.stages.assessor.costImpact = choice.value;
  recordComment(r, PERSONA_KEY, "approved", comment || ("Cost impact: " + choice.value));

  const nextPersona = choice.value === "yes" ? "financialController" : "technicalArchitect";
  advanceRequest(r, PERSONA_KEY, nextPersona);
  saveRequest(r);

  alert("Request " + r.id + " decision submitted.");
  showQueue();
}

// init
showDashboard();
document.getElementById("form-wrapper").classList.add("active");
