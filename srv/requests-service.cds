using { btp.requests as db } from '../db/schema';

service RequestsService @(path: '/api') {

  // ── CRUD entity — GET /api/Requests, POST /api/Requests, etc.
  entity Requests as projection on db.Requests;

  // ── Computed views the frontend needs
  // (Backend team implements the WHERE clauses; frontend just calls these)

  // GET /api/MyQueue?persona=assessor  →  requests where currentPersona = :persona
  // Implemented as a filtered projection; persona passed as query param $filter
  // or via the action below.

  // ── Workflow actions
  action approve(
    requestId    : String,
    personaKey   : String,
    toPersona    : String,
    comment      : String,
    attachmentName: String
  ) returns String;

  action reject(
    requestId    : String,
    personaKey   : String,
    comment      : String
  ) returns String;

  action sendBack(
    requestId    : String,
    fromPersona  : String,
    toPersona    : String,
    comment      : String
  ) returns String;

  action complete(
    requestId    : String,
    personaKey   : String,
    comment      : String
  ) returns String;

  // ── Dashboard summary
  // GET /api/dashboardSummary
  function dashboardSummary() returns {
    pending    : Integer;
    inProgress : Integer;
    approved   : Integer;
    rejected   : Integer;
    total      : Integer;
  };
}
