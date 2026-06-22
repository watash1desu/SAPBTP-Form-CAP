// ================================================================
// SHARED REQUEST STORE — CAP-ready version
//
// SAME public API as before (loadRequests, saveRequest, etc.)
// so no other file needs to change.
//
// INTERNALS now use fetch() against the CAP service at /api.
// If the CAP service is unreachable (e.g. running the HTML files
// directly from disk), it falls back to localStorage automatically
// so the demo still works standalone.
//
// When the backend team's real CAP service is live, just set:
//   const CAP_BASE = "https://your-cap-service.cfapps.eu10.hana.ondemand.com/api";
// and delete the fallback block — everything else stays the same.
// ================================================================

const CAP_BASE = "/api";          // relative path; works when served by `cds serve`
const FALLBACK_KEY = "btp_requests_v1";  // localStorage key used as fallback

// ── Feature flag: set to true to force localStorage (offline demo mode) ──────
const FORCE_LOCAL = false;

// ── Detect if CAP is reachable ────────────────────────────────────────────────
let _capAvailable = null; // null = not checked yet, true/false = cached result

async function isCapAvailable() {
  if (FORCE_LOCAL) return false;
  if (_capAvailable !== null) return _capAvailable;
  try {
    const res = await fetch(CAP_BASE + "/Requests?$top=1", { method: "GET" });
    _capAvailable = res.ok;
  } catch (e) {
    _capAvailable = false;
  }
  return _capAvailable;
}

// ================================================================
// PUBLIC API — identical signatures to the original file
// ================================================================

// Returns all requests as an array.
async function loadRequests() {
  if (await isCapAvailable()) {
    try {
      const res = await fetch(CAP_BASE + "/Requests");
      const json = await res.json();
      const raw = json.value || json;
      return raw.map(deserialiseRequest);
    } catch (e) {
      console.warn("[store] CAP read failed, falling back to localStorage", e);
    }
  }
  return localLoad();
}

// Saves (creates or updates) a single request.
async function saveRequest(updated) {
  if (await isCapAvailable()) {
    try {
      const body = serialiseRequest(updated);
      const exists = await getRequestById(updated.id);
      const method = exists ? "PATCH" : "POST";
      const url = exists
        ? CAP_BASE + "/Requests/" + encodeURIComponent(updated.id)
        : CAP_BASE + "/Requests";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return;
    } catch (e) {
      console.warn("[store] CAP write failed, falling back to localStorage", e);
    }
  }
  localSave(updated);
}

// Saves a whole list at once (used by reset and batch ops).
async function saveAllRequests(list) {
  if (await isCapAvailable()) {
    // No batch endpoint yet; save one by one
    for (const r of list) await saveRequest(r);
    return;
  }
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(list));
}

// Returns one request by id, or null.
async function getRequestById(id) {
  if (await isCapAvailable()) {
    try {
      const res = await fetch(CAP_BASE + "/Requests/" + encodeURIComponent(id));
      if (!res.ok) return null;
      const json = await res.json();
      return deserialiseRequest(json);
    } catch (e) {
      console.warn("[store] CAP getById failed, falling back to localStorage", e);
    }
  }
  return localLoad().find(r => r.id === id) || null;
}

// Clears everything and re-seeds with defaults.
async function resetRequestStore() {
  if (await isCapAvailable()) {
    // Backend team will add a /reset action; for now just reload
    _capAvailable = null; // force recheck
    return loadRequests();
  }
  localStorage.removeItem(FALLBACK_KEY);
  return localLoad();
}

// ── Workflow action helpers ────────────────────────────────────────────────────
// These replace the inline stage-mutation logic that previously lived in each
// persona's .js file. Call these instead of manually editing request.stages.

async function approveRequest(requestId, personaKey, toPersona, comment, attachmentName) {
  if (await isCapAvailable()) {
    await capAction("approve", { requestId, personaKey, toPersona, comment: comment || "", attachmentName: attachmentName || "" });
    return;
  }
  // Fallback: local mutation
  const r = await getRequestById(requestId);
  if (!r) return;
  advanceRequest(r, personaKey, toPersona);
  if (comment) recordComment(r, personaKey, "approved", comment);
  if (attachmentName) recordAttachment(r, attachmentName, personaKey);
  localSave(r);
}

async function rejectRequest(requestId, personaKey, comment) {
  if (await isCapAvailable()) {
    await capAction("reject", { requestId, personaKey, comment: comment || "" });
    return;
  }
  const r = await getRequestById(requestId);
  if (!r) return;
  rejectRequestStage(r, personaKey);
  if (comment) recordComment(r, personaKey, "rejected", comment);
  localSave(r);
}

async function sendBack(requestId, fromPersona, toPersona, comment) {
  if (await isCapAvailable()) {
    await capAction("sendBack", { requestId, fromPersona, toPersona, comment: comment || "" });
    return;
  }
  const r = await getRequestById(requestId);
  if (!r) return;
  sendBackRequest(r, fromPersona, toPersona);
  if (comment) recordComment(r, fromPersona, "sent-back", comment);
  localSave(r);
}

async function completeRequest(requestId, personaKey, comment) {
  if (await isCapAvailable()) {
    await capAction("complete", { requestId, personaKey, comment: comment || "" });
    return;
  }
  const r = await getRequestById(requestId);
  if (!r) return;
  completeRequestStage(r, personaKey);
  if (comment) recordComment(r, personaKey, "approved", comment);
  localSave(r);
}

// GET /api/dashboardSummary
async function getDashboardSummary() {
  if (await isCapAvailable()) {
    try {
      const res = await fetch(CAP_BASE + "/dashboardSummary()");
      return await res.json();
    } catch (e) {
      console.warn("[store] dashboardSummary failed, computing locally", e);
    }
  }
  // Local fallback
  const all = localLoad();
  return {
    pending:    all.filter(r => r.status === "pending").length,
    inProgress: all.filter(r => r.status === "in-progress").length,
    approved:   all.filter(r => r.status === "approved").length,
    rejected:   all.filter(r => r.status === "rejected").length,
    total:      all.length
  };
}

// ================================================================
// Internal helpers
// ================================================================

async function capAction(actionName, body) {
  const res = await fetch(CAP_BASE + "/" + actionName, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("CAP action " + actionName + " failed: " + text);
  }
  return res.json().catch(() => null);
}

// CAP sends stages/comments/attachments as JSON strings; parse them back.
function deserialiseRequest(r) {
  return {
    ...r,
    stages:      typeof r.stages      === "string" ? JSON.parse(r.stages)      : r.stages,
    comments:    typeof r.comments    === "string" ? JSON.parse(r.comments)    : r.comments,
    attachments: typeof r.attachments === "string" ? JSON.parse(r.attachments) : r.attachments
  };
}

function serialiseRequest(r) {
  return {
    ...r,
    stages:      typeof r.stages      === "object" ? JSON.stringify(r.stages)      : r.stages,
    comments:    typeof r.comments    === "object" ? JSON.stringify(r.comments)    : r.comments,
    attachments: typeof r.attachments === "object" ? JSON.stringify(r.attachments) : r.attachments
  };
}

// ── localStorage fallback (copy of original logic) ────────────────────────────
function localLoad() {
  const raw = localStorage.getItem(FALLBACK_KEY);
  if (!raw) {
    const seed = seedRequests();
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function localSave(updated) {
  const all = localLoad();
  const idx = all.findIndex(r => r.id === updated.id);
  if (idx >= 0) all[idx] = updated; else all.unshift(updated);
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(all));
}

// ── Workflow mutation helpers (used by the fallback path only) ─────────────────
function todayLabel() { return new Date().toISOString().slice(0, 10); }

function advanceRequest(r, fromPersona, toPersona) {
  r.stages[fromPersona].state    = "approved";
  r.stages[fromPersona].decision = "approved";
  r.stages[fromPersona].actedOn  = todayLabel();
  r.currentPersona = toPersona;
  r.status = "in-progress";
}

function rejectRequestStage(r, fromPersona) {
  r.stages[fromPersona].state    = "rejected";
  r.stages[fromPersona].decision = "rejected";
  r.stages[fromPersona].actedOn  = todayLabel();
  r.status = "rejected";
}

function sendBackRequest(r, fromPersona, toPersona) {
  r.stages[fromPersona].state    = "pending";
  r.stages[fromPersona].decision = "sent-back";
  r.stages[fromPersona].actedOn  = todayLabel();
  r.stages[toPersona].sentBack   = true;
  r.stages[toPersona].state      = "pending";
  r.currentPersona = toPersona;
  r.status = "in-progress";
}

function completeRequestStage(r, fromPersona) {
  r.stages[fromPersona].state    = "approved";
  r.stages[fromPersona].decision = "approved";
  r.stages[fromPersona].actedOn  = todayLabel();
  r.status = "approved";
}

function recordComment(r, personaKey, decision, text) {
  if (text && text.trim()) {
    r.comments.push({ persona: personaKey, name: PERSONA_LABELS[personaKey] || personaKey, date: todayLabel(), text: text.trim(), decision });
  }
}

function recordAttachment(r, fileName, persona) {
  if (!fileName) return;
  r.attachments.push({ name: fileName, uploadedBy: PERSONA_LABELS[persona] || persona, uploadedOn: todayLabel() });
}

// ── Constants (unchanged from original) ───────────────────────────────────────
const PERSONA_ORDER  = ["assessor","financialController","technicalArchitect","btpcoeHead","admin"];
const PERSONA_LABELS = { assessor:"Assessor", financialController:"Financial Controller", technicalArchitect:"Technical Architect", btpcoeHead:"BTPCOE Head", admin:"Admin" };
const PERSONA_INITIALS = { assessor:"AS", financialController:"FC", technicalArchitect:"TA", btpcoeHead:"BH", admin:"AD" };
const PERSONA_PAGES  = { assessor:"assessor.html", financialController:"financial-controller.html", technicalArchitect:"technical-architect.html", btpcoeHead:"btpcoe-head.html", admin:"admin.html" };
const CATEGORY_LABELS = { "subaccount-creation":"Subaccount Creation","directory-creation":"Directory Creation","subaccount-name-change":"Subaccount Name Change","use-case-initiation":"Use Case Initiation","entitlement-configuration":"Entitlement Configuration","role-access":"Role Access in SAP BTP","other":"Other" };
const REGION_LABELS  = { "ap-mumbai":"Asia Pacific (Mumbai)","ap-singapore":"Asia Pacific (Singapore)","eu-frankfurt":"Europe (Frankfurt)","us-east":"US East (Virginia)","us-west":"US West (Oregon)" };

function generateRequestId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return "REQ-2026-" + code;
}

function emptyStage() { return { state:"pending", decision:null, comment:"", actedOn:null, sentBack:false }; }
function newStagesBlock() { return { assessor:emptyStage(), financialController:emptyStage(), technicalArchitect:emptyStage(), btpcoeHead:emptyStage(), admin:emptyStage() }; }

// ── Render helpers (unchanged — pure UI, no data-layer concern) ───────────────
function renderStepper(request) {
  const order = PERSONA_ORDER;
  const currentIndex = order.indexOf(request.currentPersona);
  const isRejected   = request.status === "rejected";
  const isComplete   = request.status === "approved";
  let rejectedIndex  = -1;
  if (isRejected) rejectedIndex = order.findIndex(p => request.stages[p].decision === "rejected");

  let html = '<div class="stepper">';
  order.forEach(function (persona, i) {
    const stage = request.stages[persona];
    let circleClass = "stepper-circle";
    let icon = String(i + 1);
    let stateLabel = "Pending";
    let stateDate  = "";

    if (isRejected && i === rejectedIndex) {
      circleClass += " stepper-circle--rejected"; icon = "&#10005;"; stateLabel = "Rejected"; stateDate = stage.actedOn || "";
    } else if (isRejected && i > rejectedIndex) {
      circleClass += " stepper-circle--void"; stateLabel = "Not Reached";
    } else if (i < currentIndex || (isComplete && i <= currentIndex)) {
      icon = "&#10003;"; stateDate = stage.actedOn || "";
      if (stage.sentBack) { circleClass += " stepper-circle--sentback"; stateLabel = "Approved (after send-back)"; }
      else { circleClass += " stepper-circle--done"; stateLabel = "Approved"; }
    } else if (i === currentIndex && !isComplete) {
      circleClass += " stepper-circle--active"; stateLabel = "(You are here) Pending";
    } else if (i > currentIndex && stage.decision === "sent-back") {
      circleClass += " stepper-circle--sentback"; icon = "&#8617;"; stateLabel = "Sent Back"; stateDate = stage.actedOn || "";
    }

    html += '<div class="stepper-step">';
    html += '<div class="' + circleClass + '">' + icon + '</div>';
    html += '<div class="stepper-label">';
    html += '<span class="stepper-name">' + PERSONA_LABELS[persona] + '</span>';
    html += '<span class="stepper-state">' + stateLabel + '</span>';
    if (stateDate) html += '<span class="stepper-date">' + stateDate + '</span>';
    html += '</div></div>';
    if (i < order.length - 1) html += '<div class="stepper-connector"></div>';
  });
  html += '</div>';
  return html;
}

function renderCommentsAndAttachments(request) {
  let commentsHtml = "";
  if (!request.comments || request.comments.length === 0) {
    commentsHtml = '<p class="empty-state" style="padding:16px 0;">No comments yet.</p>';
  } else {
    request.comments.slice().reverse().forEach(function (c) {
      const isR = c.decision === "rejected";
      const isS = c.decision === "sent-back";
      let iconClass = "comment-icon--approve"; let icon = "&#10003;";
      if (isR) { iconClass = "comment-icon--reject"; icon = "&#10005;"; }
      else if (isS) { iconClass = "comment-icon--sentback"; icon = "&#8617;"; }
      commentsHtml += '<div class="approver-comment">';
      commentsHtml += '<div class="approver-comment-head"><strong>' + c.name + '</strong><span>' + c.date + '</span>';
      commentsHtml += '<span class="comment-icon ' + iconClass + '">' + icon + '</span></div>';
      commentsHtml += '<p>' + c.text + '</p></div>';
    });
  }
  let attachmentsHtml = "";
  if (!request.attachments || request.attachments.length === 0) {
    attachmentsHtml = '<p class="empty-state" style="padding:16px 0;">No attachments.</p>';
  } else {
    request.attachments.forEach(function (a) {
      attachmentsHtml += '<div class="attachment-row">';
      attachmentsHtml += '<span class="attachment-name">&#128206; ' + a.name + '</span>';
      attachmentsHtml += '<span class="attachment-meta">Uploaded by ' + a.uploadedBy + ' &middot; ' + a.uploadedOn + '</span>';
      attachmentsHtml += '</div>';
    });
  }
  return '<div class="detail-columns"><div class="detail-column"><h3 class="detail-column-title">Previous Comments</h3>' + commentsHtml + '</div><div class="detail-column"><h3 class="detail-column-title">Attachments (' + (request.attachments ? request.attachments.length : 0) + ')</h3>' + attachmentsHtml + '</div></div>';
}

function rowHtml(label, value, fullWidth) {
  return '<div class="review-row' + (fullWidth ? ' review-row--full' : '') + '"><span class="review-row-label">' + label + '</span><span class="review-row-value">' + (value || "—") + '</span></div>';
}

function renderRequestDetailsCard(r) {
  return '<div class="review-card"><div class="review-card-header"><span>&#128196;</span><span>Request Details</span></div><div class="review-card-body">' + rowHtml("Request ID", r.id) + rowHtml("Category", CATEGORY_LABELS[r.category] || r.category) + rowHtml("Priority", r.priority) + rowHtml("Title", r.title) + rowHtml("Required By", r.requiredByDate) + rowHtml("Business Unit", r.businessUnit) + rowHtml("Department", r.department) + rowHtml("Business Justification", r.businessJustification, true) + '</div></div><div class="review-card"><div class="review-card-header"><span>&#9729;</span><span>Service Configuration</span></div><div class="review-card-body">' + rowHtml("Subaccount Name", r.subaccountName) + rowHtml("Parent Global Account", r.parentGlobalAccount) + rowHtml("Region", REGION_LABELS[r.region] || r.region) + rowHtml("Business Owner", r.businessOwner) + rowHtml("Environment", r.environment) + rowHtml("Estimated Users", r.estimatedUsers) + '</div></div>';
}

function renderFCSummaryCard(r) {
  const fc = r.stages.financialController;
  if (!fc || !fc.monthlyCost) return "";
  return '<div class="review-card"><div class="review-card-header"><span>&#128176;</span><span>Financial Controller Assessment</span></div><div class="review-card-body">' + rowHtml("Monthly Cost (INR)", fc.monthlyCost) + rowHtml("Annual Cost (INR)", fc.annualCost) + rowHtml("Cost Center", fc.costCenter) + rowHtml("Budget Reference", fc.budgetRef) + rowHtml("Budget Approval", fc.budgetApproval === "yes" ? "Yes" : fc.budgetApproval === "no" ? "No" : "—") + '</div></div>';
}

function renderTASummaryCard(r) {
  const ta = r.stages.technicalArchitect;
  if (!ta || !ta.securityImpact) return "";
  return '<div class="review-card"><div class="review-card-header"><span>&#128736;</span><span>Technical Architect Assessment</span></div><div class="review-card-body">' + rowHtml("Security Impact", ta.securityImpact) + rowHtml("Operational Impact", ta.operationalImpact) + rowHtml("Data Privacy Impact", ta.dataPrivacyImpact) + (ta.delegateTo ? rowHtml("Delegated To", ta.delegateTo) : "") + (ta.notes ? rowHtml("Technical Notes", ta.notes) : "") + '</div></div>';
}

function renderBHSummaryCard(r) {
  const bh = r.stages.btpcoeHead;
  if (!bh || !bh.decision) return "";
  return '<div class="review-card"><div class="review-card-header"><span>&#127970;</span><span>BTPCOE Head Assessment</span></div><div class="review-card-body">' + rowHtml("Decision", bh.decision) + (bh.delegateTo ? rowHtml("Delegated To", bh.delegateTo) : "") + '</div></div>';
}

function seedRequests() {
  const r1Stages = newStagesBlock();
  const r2Stages = newStagesBlock();
  r2Stages.assessor.state = "approved"; r2Stages.assessor.decision = "approved";
  r2Stages.assessor.actedOn = "2026-06-17"; r2Stages.assessor.costImpact = "yes";
  return [
    { id:"REQ-2026-K7P2QX", title:"Request for Development Subaccount", category:"subaccount-creation", priority:"high", requiredByDate:"2026-06-25", businessJustification:"Need an isolated subaccount for AI Core development and testing workloads.", businessUnit:"sap-coe", department:"technology", subaccountName:"DEV-SUB-01", parentGlobalAccount:"sapcoe-global", region:"ap-mumbai", businessOwner:"Sindhu R", environment:"cloud-foundry", estimatedUsers:"12", requestedBy:"Sindhu R", createdOn:"2026-06-18", status:"pending", currentPersona:"assessor", stages:r1Stages, comments:[], attachments:[{ name:"Business_Justification.pdf", uploadedBy:"Sindhu R", uploadedOn:"2026-06-18" }] },
    { id:"REQ-2026-7M3VWQ", title:"Entitlement Increase — AI Core", category:"entitlement-configuration", priority:"medium", requiredByDate:"2026-06-23", businessJustification:"Existing entitlement quota is insufficient for the new document-AI use case.", businessUnit:"technology", department:"technology", subaccountName:"AI-CORE-PROD", parentGlobalAccount:"prod-global", region:"eu-frankfurt", businessOwner:"Rahul Mehta", environment:"kyma", estimatedUsers:"40", requestedBy:"Rahul Mehta", createdOn:"2026-06-16", status:"in-progress", currentPersona:"financialController", stages:r2Stages, comments:[{ persona:"assessor", name:"Assessor", date:"2026-06-17", text:"Cost impact identified — routing to Financial Controller for budget review.", decision:"approved" }], attachments:[{ name:"Architecture_Diagram.png", uploadedBy:"Rahul Mehta", uploadedOn:"2026-06-16" }] }
  ];
}
