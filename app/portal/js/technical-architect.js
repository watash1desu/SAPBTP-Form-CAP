const PERSONA_KEY = "technicalArchitect";
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

// ---------------- DASHBOARD (view-only) ----------------
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
    '<div class="review-cards">' + renderRequestDetailsCard(r) + '</div>';
}

function backToDashboard() {
  setActivePage("dashboard-view", "nav-dashboard");
  document.getElementById("page-title").textContent = "Dashboard";
  document.getElementById("page-subtitle").textContent = "Overview of all service requests";
  renderDashboard();
  updateQueueCount();
}

// ---------------- MY QUEUE (actionable) ----------------
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
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    '<div class="review-banner">Review the request details below before proceeding.</div>' +
    '<div class="review-cards" style="margin-bottom:16px;">' + renderRequestDetailsCard(r) + '</div>' +
    (fcCard ? '<div class="review-cards" style="margin-bottom:16px;">' + fcCard + '</div>' : '') +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn-primary" onclick="openTAActionStep(\'' + id + '\')">Next &#8594;</button>' +
    '</div>';
}

function openTAActionStep(id) {
  activeQueueId = id;
  var r = getRequestById(id);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    renderStepper(r) +
    renderCommentsAndAttachments(r) +
    buildTAActionPanel(r);
  toggleTARequiredFields();
}

function buildDetailHeader(r) {
  return (
    '<div class="detail-header">' +
      '<div class="detail-header-top"><span class="detail-title">' + r.title + '</span><span class="priority-tag priority-tag--' + r.priority + '">' + r.priority + '</span></div>' +
      '<div class="detail-id-row"><span>' + r.id + '</span><span>Requested by ' + r.requestedBy + '</span><span>Due ' + r.requiredByDate + '</span><span>Created ' + r.createdOn + '</span></div>' +
    '</div>'
  );
}

function buildTAActionPanel(r) {
  // Determine who to send-back to: if FC was involved, send back to FC; otherwise send back to Assessor
  var prevPersona = (r.stages.financialController && r.stages.financialController.decision === "approved")
    ? "Financial Controller"
    : "Assessor";
  var prevPersonaVal = (r.stages.financialController && r.stages.financialController.decision === "approved")
    ? "financialController"
    : "assessor";

  return (
    '<div class="form-section">' +
      '<h2 class="section-title">Technical Assessment</h2>' +

      // Row 1: Security Impact + Delegate To
      '<div class="field-row" style="align-items:flex-start;gap:16px;margin-bottom:14px;">' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label" id="taSecurityImpactLabel">Security Impact</label>' +
          '<select class="field-select" id="taSecurityImpact">' +
            '<option value="" disabled selected>Select level</option>' +
            '<option value="low">Low</option>' +
            '<option value="medium">Medium</option>' +
            '<option value="high">High</option>' +
          '</select>' +
        '</div>' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label">Delegate To (Optional)</label>' +
          '<input class="field-input" type="text" id="taDelegateTo1" placeholder="Name or email of delegate">' +
        '</div>' +
      '</div>' +

      // Row 2: Operational Impact + Delegate To
      '<div class="field-row" style="align-items:flex-start;gap:16px;margin-bottom:14px;">' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label" id="taOperationalImpactLabel">Operational Impact</label>' +
          '<select class="field-select" id="taOperationalImpact">' +
            '<option value="" disabled selected>Select level</option>' +
            '<option value="low">Low</option>' +
            '<option value="medium">Medium</option>' +
            '<option value="high">High</option>' +
          '</select>' +
        '</div>' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label">Delegate To (Optional)</label>' +
          '<input class="field-input" type="text" id="taDelegateTo2" placeholder="Name or email of delegate">' +
        '</div>' +
      '</div>' +

      // Row 3: Data Privacy Impact + Delegate To 
      '<div class="field-row" style="align-items:flex-start;gap:16px;margin-bottom:14px;">' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label" id="taDataPrivacyImpactLabel">Data Privacy Impact</label>' +
          '<select class="field-select" id="taDataPrivacyImpact">' +
            '<option value="" disabled selected>Select level</option>' +
            '<option value="low">Low</option>' +
            '<option value="medium">Medium</option>' +
            '<option value="high">High</option>' +
          '</select>' +
        '</div>' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label">Delegate To (Optional)</label>' +
          '<input class="field-input" type="text" id="taDelegateTo" placeholder="Name or email of delegate">' +
        '</div>' +
      '</div>' +

      // Technical Notes 
      '<div class="field-group" style="margin-bottom:14px;">' +
        '<label class="field-label">Technical Notes / Architecture Remarks</label>' +
        '<textarea class="field-textarea" id="taNotes" rows="2" placeholder="Optional architecture remarks..."></textarea>' +
      '</div>' +

      // Supporting Document
      '<div class="field-group" style="margin-bottom:14px;">' +
        '<label class="field-label">Supporting Document (Optional)</label>' +
        '<div class="upload-box upload-box--compact" onclick="document.getElementById(\'taDocInput\').click()">Click to attach a technical review document</div>' +
        '<input type="file" id="taDocInput" style="display:none" onchange="handleTADocSelect(event)">' +
        '<p class="field-hint" id="taDocName"></p>' +
      '</div>' +
    '</div>' +

    // Your Action — Decision and Comment side by side
    '<div class="action-panel">' +
      '<div class="action-panel-title">Your Action</div>' +
      '<div class="field-row" style="align-items:flex-start;gap:16px;">' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label">Decision <span class="required">*</span></label>' +
          '<select class="field-select" id="taDecision" onchange="toggleTARequiredFields()">' +
            '<option value="" disabled selected>Select Status</option>' +
            '<option value="approved">\u25cf Approve</option>' +
            '<option value="rejected">\u25cf Reject</option>' +
            '<option value="sent-back">\u25cf Send Back to ' + prevPersona + '</option>' +
          '</select>' +
        '</div>' +
        '<div class="field-group" style="flex:1;">' +
          '<label class="field-label" id="taCommentLabel">Comment (Optional)</label>' +
          '<textarea class="field-textarea" id="taComment" rows="3" placeholder="Add comments..."></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="action-panel-buttons" style="margin-top:14px;">' +
        '<button class="btn-primary" onclick="submitTADecision(\'' + prevPersonaVal + '\')">Submit Decision</button>' +
      '</div>' +
    '</div>'
  );
}

var pendingTADocName = "";
function handleTADocSelect(event) {
  var file = event.target.files[0];
  pendingTADocName = file ? file.name : "";
  document.getElementById("taDocName").textContent = pendingTADocName ? ("Attached: " + pendingTADocName) : "";
}

function toggleTARequiredFields() {
  var decision = document.getElementById("taDecision").value;
  var needsAssessment = decision === "approved";
  var needsComment = decision === "rejected" || decision === "sent-back";

  ["taSecurityImpactLabel", "taOperationalImpactLabel", "taDataPrivacyImpactLabel"].forEach(function (labelId) {
    var label = document.getElementById(labelId);
    if (!label) return;
    var baseText = label.textContent.replace(/\s*\*$/, "").trim();
    label.innerHTML = baseText + (needsAssessment ? ' <span class="required">*</span>' : "");
  });

  var commentLabel = document.getElementById("taCommentLabel");
  if (commentLabel) commentLabel.innerHTML = needsComment ? 'Comments and Remarks <span class="required">*</span>' : 'Comments and Remarks';
}

function submitTADecision(sendBackTarget) {
  var decisionEl = document.getElementById("taDecision");
  var decision = decisionEl.value;
  if (!decision) { alert("Please select a decision before submitting."); return; }

  var securityImpact = document.getElementById("taSecurityImpact").value;
  var operationalImpact = document.getElementById("taOperationalImpact").value;
  var dataPrivacyImpact = document.getElementById("taDataPrivacyImpact").value;

  if (decision === "approved") {
    if (!securityImpact || !operationalImpact || !dataPrivacyImpact) {
      alert("Security, Operational and Data Privacy Impact are all required to approve.");
      return;
    }
  }

  var r = getRequestById(activeQueueId);
  var comment = document.getElementById("taComment").value.trim();
  if ((decision === "rejected" || decision === "sent-back") && !comment) {
    alert("Please add a comment explaining why this request is being " + (decision === "rejected" ? "rejected." : "sent back."));
    return;
  }

  // Save assessment fields — combine all three delegate inputs
  r.stages.technicalArchitect.securityImpact = securityImpact;
  r.stages.technicalArchitect.operationalImpact = operationalImpact;
  r.stages.technicalArchitect.dataPrivacyImpact = dataPrivacyImpact;
  var d1 = document.getElementById("taDelegateTo1") ? document.getElementById("taDelegateTo1").value.trim() : "";
  var d2 = document.getElementById("taDelegateTo2") ? document.getElementById("taDelegateTo2").value.trim() : "";
  var d3 = document.getElementById("taDelegateTo") ? document.getElementById("taDelegateTo").value.trim() : "";
  r.stages.technicalArchitect.delegateTo = [d1, d2, d3].filter(Boolean).join(", ");
  r.stages.technicalArchitect.notes = document.getElementById("taNotes").value;

  if (pendingTADocName) {
    recordAttachment(r, pendingTADocName, PERSONA_KEY);
  }

  if (decision === "approved") {
    recordComment(r, PERSONA_KEY, "approved", comment || "Technical assessment complete. Approved.");
    advanceRequest(r, PERSONA_KEY, "btpcoeHead");
    saveRequest(r);
    alert("Request " + r.id + " approved and routed to BTPCOE Head.");
    showQueue();
  } else if (decision === "rejected") {
    recordComment(r, PERSONA_KEY, "rejected", comment || "Rejected at Technical Architect stage.");
    rejectRequestStage(r, PERSONA_KEY);
    saveRequest(r);
    alert("Request " + r.id + " has been rejected.");
    showQueue();
  } else {
    recordComment(r, PERSONA_KEY, "sent-back", comment || "Sent back for clarification.");
    sendBackRequest(r, PERSONA_KEY, sendBackTarget);
    saveRequest(r);
    alert("Request " + r.id + " sent back to " + PERSONA_LABELS[sendBackTarget] + ".");
    showQueue();
  }
}

// init
pendingTADocName = "";
showDashboard();
document.getElementById("form-wrapper").classList.add("active");