namespace btp.requests;

// ─── Enums (kept as string types for simplicity) ──────────────────────────────
// status:         pending | in-progress | approved | rejected
// currentPersona: assessor | financialController | technicalArchitect | btpcoeHead | admin
// priority:       low | medium | high | critical
// category:       subaccount-creation | directory-creation | subaccount-name-change |
//                 use-case-initiation | entitlement-configuration | role-access | other
// region:         ap-mumbai | ap-singapore | eu-frankfurt | us-east | us-west
// environment:    cloud-foundry | kyma | other

// ─── Stage snapshot (one per approval persona) ────────────────────────────────
// Stored as JSON blobs so the schema doesn't need a join for every stage read.
// When the backend team wants relational stages, promote these to
// separate entities — the frontend only ever reads the `stages` field as a whole.

// ─── Main entity ─────────────────────────────────────────────────────────────
entity Requests {
  key id               : String(30);       // e.g. REQ-2026-K7P2QX

  // ── Core request fields
  title                : String(200);
  category             : String(50);
  priority             : String(20);
  status               : String(20);       // pending | in-progress | approved | rejected
  currentPersona       : String(30);       // which persona's queue it sits in

  // ── Dates
  createdOn            : String(10);       // ISO date string e.g. 2026-06-18
  requiredByDate       : String(10);

  // ── Requestor info
  requestedBy          : String(100);
  businessUnit         : String(100);
  department           : String(100);
  businessJustification: String(2000);

  // ── Service configuration
  subaccountName       : String(100);
  parentGlobalAccount  : String(100);
  region               : String(50);
  businessOwner        : String(100);
  environment          : String(50);
  estimatedUsers       : String(20);

  // ── Per-stage data + workflow state — stored as JSON blobs.
  //    Shape mirrors the stages object in requests-store.js exactly.
  stages               : LargeString;     // JSON: { assessor:{}, financialController:{}, ... }
  comments             : LargeString;     // JSON: [ { persona, name, date, text, decision } ]
  attachments          : LargeString;     // JSON: [ { name, uploadedBy, uploadedOn } ]
}

// ─── Actions exposed by the service (defined in requests-service.cds) ─────────
// approve(requestId, personaKey, comment?, attachmentName?)  → advances to next persona
// reject(requestId, personaKey, comment?)                    → terminates request
// sendBack(requestId, fromPersona, toPersona, comment?)      → routes back for rework
// complete(requestId, personaKey, comment?)                  → admin marks done
