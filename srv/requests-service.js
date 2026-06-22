// when the backend team is ready: delete the IN-MEMORY STORE section below
// and replace each handler body with `await db.run(...)` calls — the service
// interface (actions, paths, return shapes) doesn't change.
// ─────────────────────────────────────────────────────────────────────────────

const cds = require("@sap/cds");

// ─── Helpers ────────
function todayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function emptyStage() {
  return { state: "pending", decision: null, comment: "", actedOn: null, sentBack: false };
}

function newStagesBlock() {
  return {
    assessor: emptyStage(),
    financialController: emptyStage(),
    technicalArchitect: emptyStage(),
    btpcoeHead: emptyStage(),
    admin: emptyStage()
  };
}

// ─── IN-MEMORY STORE (replace with DB queries when backend is ready) ──────────
const r1Stages = newStagesBlock();
const r2Stages = newStagesBlock();
r2Stages.assessor.state = "approved";
r2Stages.assessor.decision = "approved";
r2Stages.assessor.actedOn = "2026-06-17";
r2Stages.assessor.costImpact = "yes";

let REQUESTS = [
  {
    id: "REQ-2026-K7P2QX",
    title: "Request for Development Subaccount",
    category: "subaccount-creation",
    priority: "high",
    requiredByDate: "2026-06-25",
    businessJustification: "Need an isolated subaccount for AI Core development and testing workloads.",
    businessUnit: "sap-coe",
    department: "technology",
    subaccountName: "DEV-SUB-01",
    parentGlobalAccount: "sapcoe-global",
    region: "ap-mumbai",
    businessOwner: "Sindhu R",
    environment: "cloud-foundry",
    estimatedUsers: "12",
    requestedBy: "Sindhu R",
    createdOn: "2026-06-18",
    status: "pending",
    currentPersona: "assessor",
    stages: r1Stages,
    comments: [],
    attachments: [{ name: "Business_Justification.pdf", uploadedBy: "Sindhu R", uploadedOn: "2026-06-18" }]
  },
  {
    id: "REQ-2026-7M3VWQ",
    title: "Entitlement Increase — AI Core",
    category: "entitlement-configuration",
    priority: "medium",
    requiredByDate: "2026-06-23",
    businessJustification: "Existing entitlement quota is insufficient for the new document-AI use case.",
    businessUnit: "technology",
    department: "technology",
    subaccountName: "AI-CORE-PROD",
    parentGlobalAccount: "prod-global",
    region: "eu-frankfurt",
    businessOwner: "Rahul Mehta",
    environment: "kyma",
    estimatedUsers: "40",
    requestedBy: "Rahul Mehta",
    createdOn: "2026-06-16",
    status: "in-progress",
    currentPersona: "financialController",
    stages: r2Stages,
    comments: [
      { persona: "assessor", name: "Assessor", date: "2026-06-17", text: "Cost impact identified — routing to Financial Controller for budget review.", decision: "approved" }
    ],
    attachments: [{ name: "Architecture_Diagram.png", uploadedBy: "Rahul Mehta", uploadedOn: "2026-06-16" }]
  }
];

// ─── Serialise stages/comments/attachments for OData response ─────────────────
function serialise(r) {
  return {
    ...r,
    stages: typeof r.stages === "string" ? r.stages : JSON.stringify(r.stages),
    comments: typeof r.comments === "string" ? r.comments : JSON.stringify(r.comments),
    attachments: typeof r.attachments === "string" ? r.attachments : JSON.stringify(r.attachments)
  };
}

function deserialise(r) {
  return {
    ...r,
    stages: typeof r.stages === "string" ? JSON.parse(r.stages) : r.stages,
    comments: typeof r.comments === "string" ? JSON.parse(r.comments) : r.comments,
    attachments: typeof r.attachments === "string" ? JSON.parse(r.attachments) : r.attachments
  };
}

function findRequest(id) {
  return REQUESTS.find(r => r.id === id) || null;
}

function saveRequest(updated) {
  const idx = REQUESTS.findIndex(r => r.id === updated.id);
  if (idx >= 0) REQUESTS[idx] = updated;
  else REQUESTS.unshift(updated);
}

function generateId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return "REQ-2026-" + code;
}

// ─── Module export ────────────────────────────────────────────────────────────
module.exports = cds.service.impl(async function (srv) {

  // ── GET /api/Requests  (and ?$filter=currentPersona eq 'assessor' etc.)
  srv.on("READ", "Requests", async (req) => {
    // Simple in-memory filter for $filter support
    let results = REQUESTS.map(serialise);
    const filter = req.query.SELECT && req.query.SELECT.where;
    // For now returns all; CAP will apply OData $filter automatically once a real
    // DB is wired in. Frontend sends ?currentPersona=assessor as a plain param.
    const persona = req.data && req.data.persona;
    if (persona) {
      results = results.filter(r => r.currentPersona === persona);
    }
    return results;
  });

  // ── POST /api/Requests  (create new request from requestor.html)
  srv.on("CREATE", "Requests", async (req) => {
    const data = req.data;
    const newReq = {
      id: data.id || generateId(),
      title: data.title,
      category: data.category,
      priority: data.priority,
      requiredByDate: data.requiredByDate,
      businessJustification: data.businessJustification,
      businessUnit: data.businessUnit,
      department: data.department,
      subaccountName: data.subaccountName,
      parentGlobalAccount: data.parentGlobalAccount,
      region: data.region,
      businessOwner: data.businessOwner,
      environment: data.environment,
      estimatedUsers: data.estimatedUsers,
      requestedBy: data.requestedBy,
      createdOn: todayLabel(),
      status: "pending",
      currentPersona: "assessor",
      stages: newStagesBlock(),
      comments: [],
      attachments: []
    };
    REQUESTS.unshift(newReq);
    return serialise(newReq);
  });

  // ── PATCH /api/Requests/:id  (generic field updates if needed)
  srv.on("UPDATE", "Requests", async (req) => {
    const r = findRequest(req.data.id);
    if (!r) return req.error(404, "Request not found");
    Object.assign(r, deserialise(req.data));
    saveRequest(r);
    return serialise(r);
  });

  // ── action: approve
  srv.on("approve", async (req) => {
    const { requestId, personaKey, toPersona, comment, attachmentName } = req.data;
    const r = findRequest(requestId);
    if (!r) return req.error(404, "Request not found");

    r.stages[personaKey].state = "approved";
    r.stages[personaKey].decision = "approved";
    r.stages[personaKey].actedOn = todayLabel();

    if (comment && comment.trim()) {
      r.comments.push({ persona: personaKey, name: personaKey, date: todayLabel(), text: comment.trim(), decision: "approved" });
    }
    if (attachmentName) {
      r.attachments.push({ name: attachmentName, uploadedBy: personaKey, uploadedOn: todayLabel() });
    }

    if (toPersona) {
      r.currentPersona = toPersona;
      r.status = "in-progress";
    }
    saveRequest(r);
    return "ok";
  });

  // ── action: reject
  srv.on("reject", async (req) => {
    const { requestId, personaKey, comment } = req.data;
    const r = findRequest(requestId);
    if (!r) return req.error(404, "Request not found");

    r.stages[personaKey].state = "rejected";
    r.stages[personaKey].decision = "rejected";
    r.stages[personaKey].actedOn = todayLabel();
    r.status = "rejected";

    if (comment && comment.trim()) {
      r.comments.push({ persona: personaKey, name: personaKey, date: todayLabel(), text: comment.trim(), decision: "rejected" });
    }
    saveRequest(r);
    return "ok";
  });

  // ── action: sendBack
  srv.on("sendBack", async (req) => {
    const { requestId, fromPersona, toPersona, comment } = req.data;
    const r = findRequest(requestId);
    if (!r) return req.error(404, "Request not found");

    r.stages[fromPersona].state = "pending";
    r.stages[fromPersona].decision = "sent-back";
    r.stages[fromPersona].actedOn = todayLabel();
    r.stages[toPersona].sentBack = true;
    r.stages[toPersona].state = "pending";
    r.currentPersona = toPersona;
    r.status = "in-progress";

    if (comment && comment.trim()) {
      r.comments.push({ persona: fromPersona, name: fromPersona, date: todayLabel(), text: comment.trim(), decision: "sent-back" });
    }
    saveRequest(r);
    return "ok";
  });

  // ── action: complete  (admin marks done)
  srv.on("complete", async (req) => {
    const { requestId, personaKey, comment } = req.data;
    const r = findRequest(requestId);
    if (!r) return req.error(404, "Request not found");

    r.stages[personaKey].state = "approved";
    r.stages[personaKey].decision = "approved";
    r.stages[personaKey].actedOn = todayLabel();
    r.status = "approved";

    if (comment && comment.trim()) {
      r.comments.push({ persona: personaKey, name: personaKey, date: todayLabel(), text: comment.trim(), decision: "approved" });
    }
    saveRequest(r);
    return "ok";
  });

  // ── function: dashboardSummary
  srv.on("dashboardSummary", async (req) => {
    const counts = { pending: 0, inProgress: 0, approved: 0, rejected: 0, total: REQUESTS.length };
    REQUESTS.forEach(r => {
      if (r.status === "pending") counts.pending++;
      else if (r.status === "in-progress") counts.inProgress++;
      else if (r.status === "approved") counts.approved++;
      else if (r.status === "rejected") counts.rejected++;
    });
    return counts;
  });
});
