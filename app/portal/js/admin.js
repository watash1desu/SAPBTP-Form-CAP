const PERSONA_KEY = "admin";
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
  document.getElementById("page-subtitle").textContent = "Requests pending execution";
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
    '<div class="review-cards">' + renderRequestDetailsCard(r) + renderFullApprovalSummaryCard(r) + '</div>';
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

  if (myQueue.length === 0) { listEl.innerHTML = "<li class='empty-state'>Nothing pending execution right now.</li>"; return; }

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
  // Step 1: view-only request details + all prior step summaries
  var fcCard = renderFCSummaryCard(r);
  var taCard = (typeof renderTASummaryCard === 'function') ? renderTASummaryCard(r) : '';
  var bhCard = (typeof renderBHSummaryCard === 'function') ? renderBHSummaryCard(r) : '';
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    '<div class="review-banner">Review the request details below before proceeding.</div>' +
    '<div class="review-cards" style="margin-bottom:16px;">' + renderRequestDetailsCard(r) + '</div>' +
    (fcCard ? '<div class="review-cards" style="margin-bottom:16px;">' + fcCard + '</div>' : '') +
    (taCard ? '<div class="review-cards" style="margin-bottom:16px;">' + taCard + '</div>' : '') +
    (bhCard ? '<div class="review-cards" style="margin-bottom:16px;">' + bhCard + '</div>' : '') +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn-primary" onclick="openAdminActionStep(\'' + id + '\')">Next &#8594;</button>' +
    '</div>';
}

function openAdminActionStep(id) {
  activeQueueId = id;
  var r = getRequestById(id);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    renderStepper(r) +
    renderCommentsAndAttachments(r) +
    buildAdminActionPanel();
}

function buildDetailHeader(r) {
  return (
    '<div class="detail-header">' +
      '<div class="detail-header-top"><span class="detail-title">' + r.title + '</span><span class="priority-tag priority-tag--' + r.priority + '">' + r.priority + '</span></div>' +
      '<div class="detail-id-row"><span>' + r.id + '</span><span>Requested by ' + r.requestedBy + '</span><span>Due ' + r.requiredByDate + '</span><span>Created ' + r.createdOn + '</span></div>' +
    '</div>'
  );
}

// Full summary card showing all prior approvals at a glance
function renderFullApprovalSummaryCard(r) {
  var rows = "";

  var a = r.stages.assessor;
  if (a && a.decision) {
    rows += rowHtml("Assessor Decision", a.decision + (a.costImpact ? " (Cost impact: " + a.costImpact + ")" : ""));
  }

  var fc = r.stages.financialController;
  if (fc && fc.decision === "approved") {
    rows += rowHtml("Financial Controller Decision", "Approved");
    if (fc.costCenter) rows += rowHtml("Cost Center", fc.costCenter);
    if (fc.monthlyCost) rows += rowHtml("Monthly Cost (INR)", fc.monthlyCost);
    if (fc.annualCost) rows += rowHtml("Annual Cost (INR)", fc.annualCost);
  }

  var ta = r.stages.technicalArchitect;
  if (ta && ta.securityImpact) {
    rows += rowHtml("TA Decision", ta.decision || "approved");
    rows += rowHtml("Security Impact", ta.securityImpact);
    rows += rowHtml("Operational Impact", ta.operationalImpact);
    rows += rowHtml("Data Privacy Impact", ta.dataPrivacyImpact);
  }

  var bh = r.stages.btpcoeHead;
  if (bh && bh.decision) {
    rows += rowHtml("BTPCOE Head Decision", bh.decision);
  }

  if (!rows) return "";
  return (
    '<div class="review-card">' +
      '<div class="review-card-header"><span>&#9989;</span><span>Approval Chain Summary</span></div>' +
      '<div class="review-card-body">' + rows + '</div>' +
    '</div>'
  );
}

function buildAdminActionPanel() {
  return (
    '<div class="action-panel">' +
      '<div class="action-panel-title">Your Action</div>' +
      '<div class="action-panel-row">' +
        '<div class="field-group">' +
          '<label class="field-label">Decision <span class="required">*</span></label>' +
          '<select class="field-select" id="adminDecision">' +
            '<option value="" disabled selected>Select Status</option>' +
            '<option value="execute">\u25cf Completed — Mark as Approved</option>' +
            '<option value="rejected">\u25cf Reject</option>' +
            '<option value="sent-back">\u25cf Send Back to BTPCOE Head</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="field-group" style="margin-top:12px;">' +
        '<label class="field-label">Comments and Remarks</label>' +
        '<textarea class="field-textarea" id="adminComment" rows="3" placeholder="Add any notes or comments..."></textarea>' +
      '</div>' +
      '<div class="action-panel-buttons" style="margin-top:14px;">' +
        '<button class="btn-primary" onclick="submitAdminDecision()">Submit Decision</button>' +
      '</div>' +
    '</div>'
  );
}

function submitAdminDecision() {
  var decisionEl = document.getElementById("adminDecision");
  var decision = decisionEl.value;
  if (!decision) { alert("Please select a decision before submitting."); return; }

  var r = getRequestById(activeQueueId);
  var comment = document.getElementById("adminComment").value.trim();
  if ((decision === "rejected" || decision === "sent-back") && !comment) {
    alert("Please add a comment explaining why this request is being " + (decision === "rejected" ? "rejected." : "sent back."));
    return;
  }

  if (decision === "execute") {
    recordComment(r, PERSONA_KEY, "approved", comment || "Executed and marked as approved by Admin.");
    completeRequest(r, PERSONA_KEY);
    saveRequest(r);
    alert("Request " + r.id + " has been executed and marked as approved.");
    showQueue();
  } else if (decision === "rejected") {
    recordComment(r, PERSONA_KEY, "rejected", comment || "Rejected at Admin stage.");
    rejectRequestStage(r, PERSONA_KEY);
    saveRequest(r);
    alert("Request " + r.id + " has been rejected.");
    showQueue();
  } else {
    recordComment(r, PERSONA_KEY, "sent-back", comment || "Sent back to BTPCOE Head for further review.");
    sendBackRequest(r, PERSONA_KEY, "btpcoeHead");
    saveRequest(r);
    alert("Request " + r.id + " sent back to BTPCOE Head.");
    showQueue();
  }
}

// init
showDashboard();
document.getElementById("form-wrapper").classList.add("active");