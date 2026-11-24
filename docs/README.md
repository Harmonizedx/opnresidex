# Documentation

Every document in this folder, by what a reader comes for. The project front page is the
[README](../README.md).

## Start here

| Document | What it covers |
| --- | --- |
| [FIRST-RESIDENCY.md](FIRST-RESIDENCY.md) | A first residency credential from nothing but a register extract: no HSM, no national ID API |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The layers, every core module, and how a request flows from enrolment to sign-in |
| [ROADMAP.md](ROADMAP.md) | What is planned, what triggers it, and what is deliberately not planned |

## Building against it

| Document | What it covers |
| --- | --- |
| [API.md](API.md) | Every route group, the auth model and the operator roles |
| [openapi.yaml](openapi.yaml) | The OpenAPI 3.1 description, also served by the running app at `/openapi.yaml` and `/docs` |
| [INTEGRATION.md](INTEGRATION.md) | Adding sign-in with a residency credential to a sector service |
| [SDK.md](SDK.md) | The typed client, `@openresidency/sdk` |
| [INTEROP.md](INTEROP.md) | The standards implemented, the two credential formats, and what has been verified against whom |
| [MOSIP.md](MOSIP.md) | Working inside a country that runs MOSIP: wallet issuance, eSignet sign-in, ID Authentication |

## Running it

| Document | What it covers |
| --- | --- |
| [DEPLOY.md](DEPLOY.md) | Container image, Kubernetes and Helm, configuration, key custody, the production checklist |
| [MIGRATION.md](MIGRATION.md) | Bringing an existing register across, with provenance on every row |
| [DEPLOYMENT-GOVERNANCE.md](DEPLOYMENT-GOVERNANCE.md) | The questions a government asks before running this, and an evaluator before recommending it |

## Privacy and compliance

| Document | What it covers |
| --- | --- |
| [PRIVACY.md](PRIVACY.md) | What is held and what is not, consent, erasure, retention, subject rights, known gaps |
| [templates/DPIA-TEMPLATE.md](templates/DPIA-TEMPLATE.md) | A data protection impact assessment to complete |
| [templates/ROPA-TEMPLATE.md](templates/ROPA-TEMPLATE.md) | A record of processing activities to complete |
| [templates/SCHEDULE-6-VULNERABILITY-CHECKLIST.md](templates/SCHEDULE-6-VULNERABILITY-CHECKLIST.md) | A checklist for vulnerable data subjects |

## Digital Public Good

| Document | What it covers |
| --- | --- |
| [DPG.md](DPG.md) | The mapping to the nine DPG Standard indicators, with evidence and caveats |
| [SDG.md](SDG.md) | The Sustainable Development Goals the project supports, each tied to a capability |

## Project

| Document | What it covers |
| --- | --- |
| [adr/](adr/README.md) | The decision records: one per material choice, with the options weighed |
| [PUBLISHING.md](PUBLISHING.md) | The one-time mechanics of publishing the repository, image and SDK |

Outside this folder: [CONTRIBUTING](../CONTRIBUTING.md), [GOVERNANCE](../GOVERNANCE.md),
[SECURITY](../SECURITY.md), [RELEASING](../RELEASING.md), the
[CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md) and the [CHANGELOG](../CHANGELOG.md).
