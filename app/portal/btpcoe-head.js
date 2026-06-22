const PERSONA_KEY = "btpcoeHead";
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
  var myQueue = loadRequests().filter(function (r) { return r.currentPersona === PERSONA_KEY && r.status !== "rejected" && r.status !== "approved"; });
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
  var all = loadRequests();
  var counts = { all: all.length, pending: 0, "in-progress": 0, approved: 0, rejected: 0 };
  all.forEach(function (r) { if (counts[r.status] !== undefined) counts[r.status]++; });
  document.getElementById("count-all").textContent = counts.all;
  document.getElementById("count-pending").textContent = counts.pending;
  document.getElementById("count-inprogress").textContent = counts["in-progress"];
  document.getElementById("count-approved").textContent = counts.approved;
  document.getElementById("count-rejected").textContent = counts.rejected;

  var filtered = dashFilter === "all" ? all : all.filter(function (r) { return r.status === dashFilter; });
  var list = document.getElementById("requests-list");
  if (filtered.length === 0) { list.innerHTML = "<li class='empty-state'>No requests found.</li>"; return; }

  var html = "";
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
  var r = getRequestById(id);
  if (!r) return;
  setActivePage("detail-view", "nav-dashboard");
  document.getElementById("detail-readonly-content").innerHTML =
    buildDetailHeader(r) + renderStepper(r) + renderCommentsAndAttachments(r) +
    '<div class="review-cards">' + renderRequestDetailsCard(r) + renderTASummaryCard(r) + '</div>';
}

function backToDashboard() {
  setActivePage("dashboard-view", "nav-dashboard");
  document.getElementById("page-title").textContent = "Dashboard";
  document.getElementById("page-subtitle").textContent = "Overview of all service requests";
  renderDashboard();
  updateQueueCount();
}

// ---------------- MY QUEUE ----------------
function renderQueueList() {
  var myQueue = loadRequests().filter(function (r) { return r.currentPersona === PERSONA_KEY && r.status !== "rejected" && r.status !== "approved"; });
  document.getElementById("queue-list-count").textContent = myQueue.length;
  updateQueueCount();
  var listEl = document.getElementById("queue-card-list");

  if (myQueue.length === 0) { listEl.innerHTML = "<li class='empty-state'>Nothing pending your action right now.</li>"; return; }

  var html = "";
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
  var r = getRequestById(id);
  // Step 1: view-only request details + prior step summaries
  var fcCard = renderFCSummaryCard(r);
  var taCard = renderTASummaryCard(r);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    '<div class="review-banner">Review the request details below before proceeding.</div>' +
    '<div class="review-cards" style="margin-bottom:16px;">' + renderRequestDetailsCard(r) + '</div>' +
    (fcCard ? '<div class="review-cards" style="margin-bottom:16px;">' + fcCard + '</div>' : '') +
    (taCard ? '<div class="review-cards" style="margin-bottom:16px;">' + taCard + '</div>' : '') +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn-primary" onclick="openBHActionStep(\'' + id + '\')">Next &#8594;</button>' +
    '</div>';
}

function openBHActionStep(id) {
  activeQueueId = id;
  var r = getRequestById(id);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    renderStepper(r) +
    renderCommentsAndAttachments(r) +
    buildBHActionPanel();
  toggleBHRequiredFields();
}

function buildDetailHeader(r) {
  return (
    '<div class="detail-header">' +
      '<div class="detail-header-top"><span class="detail-title">' + r.title + '</span><span class="priority-tag priority-tag--' + r.priority + '">' + r.priority + '</span></div>' +
      '<div class="detail-id-row"><span>' + r.id + '</span><span>Requested by ' + r.requestedBy + '</span><span>Due ' + r.requiredByDate + '</span><span>Created ' + r.createdOn + '</span></div>' +
    '</div>'
  );
}

function buildBHActionPanel() {
  return (
    '<div class="form-section">' +
      '<h2 class="section-title">BTPCOE Head Review</h2>' +
      '<div class="field-group">' +
        '<label class="field-label">Delegate To (Optional)</label>' +
        '<input class="field-input" type="text" id="bhDelegateTo" placeholder="e.g. John Smith, jane@company.com">' +
      '</div>' +
      '<div class="field-group">' +
        '<label class="field-label">Supporting Document (Optional)</label>' +
        '<div class="upload-box upload-box--compact" onclick="document.getElementById(\'bhDocInput\').click()">Click to attach a review document</div>' +
        '<input type="file" id="bhDocInput" style="display:none" onchange="handleBHDocSelect(event)">' +
        '<p class="field-hint" id="bhDocName"></p>' +
      '</div>' +
    '</div>' +
    '<div class="action-panel">' +
      '<div class="action-panel-title">Your Action</div>' +
      '<div class="action-panel-row">' +
        '<div class="field-group">' +
          '<label class="field-label">Decision <span class="required">*</span></label>' +
          '<select class="field-select" id="bhDecision" onchange="toggleBHRequiredFields()">' +
            '<option value="" disabled selected>Select Status</option>' +
            '<option value="approved">\u25cf Approve</option>' +
            '<option value="rejected">\u25cf Reject</option>' +
            '<option value="sent-back">\u25cf Send Back to Technical Architect</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="field-group" style="margin-top:12px;">' +
        '<label class="field-label" id="bhCommentLabel">Comments and Remarks <span class="required">*</span></label>' +
        '<textarea class="field-textarea" id="bhComment" rows="3" placeholder="Add your overall assessment, remarks, or reason for decision..."></textarea>' +
      '</div>' +
      '<div class="action-panel-buttons" style="margin-top:14px;">' +
        '<button class="btn-primary" onclick="submitBHDecision()">Submit Decision</button>' +
      '</div>' +
    '</div>'
  );
}

var pendingBHDocName = "";
function handleBHDocSelect(event) {
  var file = event.target.files[0];
  pendingBHDocName = file ? file.name : "";
  document.getElementById("bhDocName").textContent = pendingBHDocName ? ("Attached: " + pendingBHDocName) : "";
}

function toggleBHRequiredFields() {
  // Comment and Remarks is always required — no dynamic label change needed
}

function submitBHDecision() {
  var decisionEl = document.getElementById("bhDecision");
  var decision = decisionEl.value;
  if (!decision) { alert("Please select a decision before submitting."); return; }

  var r = getRequestById(activeQueueId);
  var comment = document.getElementById("bhComment").value.trim();
  if (!comment) {
    alert("Please add comments and remarks before submitting.");
    return;
  }

  // Save remarks to stage for admin visibility
  r.stages.btpcoeHead.remarks = comment;
  r.stages.btpcoeHead.delegateTo = document.getElementById("bhDelegateTo").value;

  if (pendingBHDocName) {
    recordAttachment(r, pendingBHDocName, PERSONA_KEY);
  }

  if (decision === "approved") {
    recordComment(r, PERSONA_KEY, "approved", comment);
    advanceRequest(r, PERSONA_KEY, "admin");
    saveRequest(r);
    alert("Request " + r.id + " approved and routed to Admin.");
    showQueue();
  } else if (decision === "rejected") {
    recordComment(r, PERSONA_KEY, "rejected", comment);
    rejectRequestStage(r, PERSONA_KEY);
    saveRequest(r);
    alert("Request " + r.id + " has been rejected.");
    showQueue();
  } else {
    recordComment(r, PERSONA_KEY, "sent-back", comment);
    sendBackRequest(r, PERSONA_KEY, "technicalArchitect");
    saveRequest(r);
    alert("Request " + r.id + " sent back to Technical Architect.");
    showQueue();
  }
}

// init
pendingBHDocName = "";
showDashboard();
document.getElementById("form-wrapper").classList.add("active");