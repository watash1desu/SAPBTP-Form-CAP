# SAP BTP Multi-Persona Approval Workflow

A full-stack service configuration request management application built on **SAP Cloud Application Programming Model (CAP)**. It implements a staged multi-persona approval queue with roles including Requestor, Assessor, Financial Controller, Technical Architect, BTPCOE Head, and Admin.

---

## Architecture

```
SAPBTP-Form-CAP/
├── app/                        # UI layer (HTML/CSS/JS frontend)
│   ├── index.html              # Landing / role selector
│   ├── requestor/              # Requestor persona pages
│   ├── assessor/               # Assessor persona pages
│   ├── financial-controller/   # FC persona pages
│   ├── technical-architect/    # TA persona pages
│   ├── btpcoe-head/            # BTPCOE Head persona pages
│   └── admin/                  # Admin persona pages
├── srv/                        # CAP service layer
│   ├── approval-service.cds    # CDS service definition
│   └── approval-service.js     # Service handler (custom logic, role checks)
├── db/                         # Data model
│   ├── schema.cds              # Entity definitions (Requests, Approvals, etc.)
│   └── data/                   # CSV seed data (optional)
├── .cdsrc.json                 # CDS configuration
├── mta.yaml                    # MTA deployment descriptor (for BTP CF)
├── package.json
└── README.md
```

> **Note:** In the original version of this project (`sap-btp-form`), the backend was a custom Express.js server (`server.js`) with manual REST route definitions. That has been replaced entirely by **CDS (Core Data Services)**. The `srv/` folder now defines both the data model exposure and business logic, and `cds serve` starts the backend — no separate Express setup needed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | SAP CAP (`@sap/cds`) |
| Service definition | CDS (`.cds` files) |
| Database (local) | SQLite (in-memory via `cds watch`) |
| Database (BTP) | SAP HANA Cloud |
| Frontend | Vanilla HTML/CSS/JS (served as CAP static resources) |
| Auth (BTP) | XSUAA + `@sap/xssec` |

---

## What Changed from the Original Repo

The original `sap-btp-form` repo used:
- A hand-written `server.js` (Express) to serve both the API and static files
- Manual JSON file or in-memory arrays as a mock database
- Route definitions scattered across individual JS files

The CAP version (`SAPBTP-Form-CAP`) replaces all of that with:
- `db/schema.cds` — single source of truth for all entities
- `srv/approval-service.cds` — declarative OData/REST service exposure
- `srv/approval-service.js` — event handlers for custom approval logic
- `cds serve` / `cds watch` — replaces running `node server.js`
- SQLite locally, swappable to HANA on BTP with zero code changes

---

## Prerequisites

- Node.js >= 18
- `@sap/cds-dk` installed globally:
  ```bash
  npm install -g @sap/cds-dk
  ```

---

## Run Locally

```bash
npm install
cds watch
```

This starts the CAP server (default: `http://localhost:4004`) with live reload. The `app/` folder is served as static files automatically.

---

## Run Without Localhost

### Option 1 — SAP Business Application Studio (BAS)
Open the project in BAS (free BTP trial), run `cds watch` in the terminal, and use the auto-generated **preview URL** — no localhost involved.

### Option 2 — Deploy to BTP Cloud Foundry

```bash
npm install -g mbt
mbt build
cf login
cf deploy mta_archives/<your-mtar-file>.mtar
```

Your app gets a public `*.cfapps.*.hana.ondemand.com` URL.

### Option 3 — Deploy to Render / Railway (quick)
Since the CAP backend is a Node.js server, any Node-compatible host works:
- Set start command to: `npx cds serve`
- Set `NODE_ENV=production`
- Point to your preferred database

---

## Personas & Workflow

```
Requestor → Assessor → Financial Controller → Technical Architect → BTPCOE Head
                                                                          ↓
                                                                       Admin (view all)
```

Each persona has a dedicated queue view and approval/rejection action. Requests move through stages sequentially; rejection at any stage returns the request to the Requestor.

---

## Deployment on BTP (Cloud Foundry)

1. Set up a BTP trial account at [cockpit.btp.cloud.sap](https://cockpit.btp.cloud.sap)
2. Create a Cloud Foundry space
3. Bind XSUAA and HANA Cloud service instances (defined in `mta.yaml`)
4. Build and deploy:
   ```bash
   mbt build
   cf deploy mta_archives/*.mtar
   ```

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.