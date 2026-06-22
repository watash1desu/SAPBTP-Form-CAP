const PERSONA_KEY = "financialController";
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

// ---------------- DASHBOARD----------------
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

// ---------------- MY QUEUE  ----------------
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
  var r = getRequestById(id);
  // Step 1: view-only request details
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    '<div class="review-banner">Review the request details below before proceeding.</div>' +
    '<div class="review-cards" style="margin-bottom:16px;">' + renderRequestDetailsCard(r) + '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:8px;">' +
      '<button class="btn-primary" onclick="openFCActionStep(\'' + id + '\')">Next &#8594;</button>' +
    '</div>';
}

function openFCActionStep(id) {
  var r = getRequestById(id);
  document.getElementById("queue-detail-panel").innerHTML =
    buildDetailHeader(r) +
    renderStepper(r) +
    renderCommentsAndAttachments(r) +
    buildFCActionPanel(r);
  toggleBudgetDocVisibility();
  toggleFCRequiredFields();
}

function buildDetailHeader(r) {
  return (
    '<div class="detail-header">' +
      '<div class="detail-header-top"><span class="detail-title">' + r.title + '</span><span class="priority-tag priority-tag--' + r.priority + '">' + r.priority + '</span></div>' +
      '<div class="detail-id-row"><span>' + r.id + '</span><span>Requested by ' + r.requestedBy + '</span><span>Due ' + r.requiredByDate + '</span><span>Created ' + r.createdOn + '</span></div>' +
    '</div>'
  );
}

function buildFCActionPanel(r) {
  return (
    '<div class="form-section">' +
      '<h2 class="section-title">Financial Assessment</h2>' +
      '<div class="field-row">' +
        '<div class="field-group"><label class="field-label" id="fcMonthlyCostLabel">Estimated Monthly Cost (INR)</label><input class="field-input" type="number" id="fcMonthlyCost" placeholder="e.g. 15000"></div>' +
        '<div class="field-group"><label class="field-label" id="fcAnnualCostLabel">Estimated Annual Cost (INR)</label><input class="field-input" type="number" id="fcAnnualCost" placeholder="e.g. 180000"></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field-group"><label class="field-label" id="fcCostCenterLabel">Cost Center</label><input class="field-input" type="text" id="fcCostCenter" placeholder="e.g. CC-TECH-1001"></div>' +
        '<div class="field-group"><label class="field-label" id="fcBudgetRefLabel">Budget Reference Number</label><input class="field-input" type="text" id="fcBudgetRef" placeholder="e.g. BUDG/2026/0456"></div>' +
      '</div>' +
      '<div class="field-group">' +
        '<label class="field-label" id="fcBudgetApprovalLabel">Budget Approval Attached?</label>' +
        '<div class="radio-group">' +
          '<label class="radio-option"><input type="radio" name="fcBudgetApproval" value="yes" onchange="toggleBudgetDocVisibility()"> Yes</label>' +
          '<label class="radio-option"><input type="radio" name="fcBudgetApproval" value="no" onchange="toggleBudgetDocVisibility()"> No</label>' +
        '</div>' +
      '</div>' +
      '<div class="field-group hidden" id="fcBudgetDocWrap">' +
        '<label class="field-label">Budget Approval Document</label>' +
        '<div class="upload-box upload-box--compact" onclick="document.getElementById(\'fcBudgetDocInput\').click()">Click to attach the budget approval document (optional)</div>' +
        '<input type="file" id="fcBudgetDocInput" style="display:none" onchange="handleBudgetDocSelect(event)">' +
        '<p class="field-hint" id="fcBudgetDocName"></p>' +
      '</div>' +
    '</div>' +
    '<div class="action-panel">' +
      '<div class="action-panel-title">Your Action</div>' +
      '<div class="action-panel-row">' +
        '<div class="field-group">' +
          '<label class="field-label">Decision <span class="required">*</span></label>' +
          '<select class="field-select" id="fcDecision" onchange="toggleFCRequiredFields()">' +
            '<option value="" disabled selected>Select Status</option>' +
            '<option value="approved">\u25cf Approve</option>' +
            '<option value="rejected">\u25cf Reject</option>' +
            '<option value="sent-back">\u25cf Send Back to Assessor</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="field-group" style="margin-top:12px;">' +
        '<label class="field-label" id="fcCommentLabel">Comments and Remarks</label>' +
        '<textarea class="field-textarea" id="fcComment" rows="3" placeholder="Add comments..."></textarea>' +
      '</div>' +
      '<div class="action-panel-buttons" style="margin-top:14px;"><button class="btn-primary" onclick="submitFCDecision()">Submit Decision</button></div>' +
    '</div>'
  );
}

function toggleFCRequiredFields() {
  const decision = document.getElementById("fcDecision").value;
  const needsFinancials = decision === "approved";
  const needsComment = decision === "rejected" || decision === "sent-back";

  const labelMap = {
    fcMonthlyCostLabel: "Estimated Monthly Cost (INR)",
    fcAnnualCostLabel: "Estimated Annual Cost (INR)",
    fcCostCenterLabel: "Cost Center",
    fcBudgetRefLabel: "Budget Reference Number",
    fcBudgetApprovalLabel: "Budget Approval Attached?"
  };
  Object.keys(labelMap).forEach(function (labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;
    label.innerHTML = labelMap[labelId] + (needsFinancials ? ' <span class="required">*</span>' : "");
  });

  const commentLabel = document.getElementById("fcCommentLabel");
  if (commentLabel) commentLabel.innerHTML = needsComment ? 'Comments and Remarks <span class="required">*</span>' : 'Comments and Remarks';
}

let pendingBudgetDocName = "";
function handleBudgetDocSelect(event) {
  const file = event.target.files[0];
  pendingBudgetDocName = file ? file.name : "";
  document.getElementById("fcBudgetDocName").textContent = pendingBudgetDocName ? ("Attached: " + pendingBudgetDocName) : "";
}

function toggleBudgetDocVisibility() {
  const yes = document.querySelector("input[name='fcBudgetApproval']:checked");
  const wrap = document.getElementById("fcBudgetDocWrap");
  if (!wrap) return;
  wrap.classList.toggle("hidden", !(yes && yes.value === "yes"));
}

function submitFCDecision() {
  const decisionEl = document.getElementById("fcDecision");
  const decision = decisionEl.value;
  if (!decision) { alert("Please select a decision before submitting."); return; }

  const r = getRequestById(activeQueueId);
  const comment = document.getElementById("fcComment").value.trim();
  const needsComment = decision === "rejected" || decision === "sent-back";
  if (needsComment && !comment) {
    alert("Please add a comment explaining why this request is being " + (decision === "rejected" ? "rejected." : "sent back."));
    return;
  }

  if (decision === "approved") {
    const monthlyCost = document.getElementById("fcMonthlyCost").value.trim();
    const annualCost = document.getElementById("fcAnnualCost").value.trim();
    const costCenterCheck = document.getElementById("fcCostCenter").value.trim();
    const budgetRefCheck = document.getElementById("fcBudgetRef").value.trim();
    const budgetApprovalCheck = document.querySelector("input[name='fcBudgetApproval']:checked");
    if (!monthlyCost || !annualCost || !costCenterCheck || !budgetRefCheck || !budgetApprovalCheck) {
      alert("Monthly Cost, Annual Cost, Cost Center, Budget Reference Number and Budget Approval are all required to approve.");
      return;
    }
  }

  if (decision !== "rejected") {
    const costCenter = document.getElementById("fcCostCenter").value.trim();
    const budgetApproval = document.querySelector("input[name='fcBudgetApproval']:checked");
    r.stages.financialController.monthlyCost = document.getElementById("fcMonthlyCost").value;
    r.stages.financialController.annualCost = document.getElementById("fcAnnualCost").value;
    r.stages.financialController.costCenter = costCenter;
    r.stages.financialController.budgetRef = document.getElementById("fcBudgetRef").value;
    r.stages.financialController.budgetApproval = budgetApproval ? budgetApproval.value : "";
    if (budgetApproval && budgetApproval.value === "yes" && pendingBudgetDocName) {
      recordAttachment(r, pendingBudgetDocName, PERSONA_KEY);
    }
  }

  if (decision === "approved") {
    recordComment(r, PERSONA_KEY, "approved", comment || "Financial assessment complete. Approved.");
    advanceRequest(r, PERSONA_KEY, "technicalArchitect");
    saveRequest(r);
    alert("Request " + r.id + " approved and routed to Technical Architect.");
    showQueue();
  } else if (decision === "rejected") {
    recordComment(r, PERSONA_KEY, "rejected", comment || "Rejected at Financial Controller stage.");
    rejectRequestStage(r, PERSONA_KEY);
    saveRequest(r);
    alert("Request " + r.id + " has been rejected.");
    showQueue();
  } else {
    recordComment(r, PERSONA_KEY, "sent-back", comment || "Sent back to Assessor for clarification.");
    sendBackRequest(r, PERSONA_KEY, "assessor");
    saveRequest(r);
    alert("Request " + r.id + " sent back to the Assessor.");
    showQueue();
  }
}

// init
pendingBudgetDocName = "";
showDashboard();
document.getElementById("form-wrapper").classList.add("active");
