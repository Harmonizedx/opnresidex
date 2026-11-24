# Architecture

OpnResidex is built as a small framework-agnostic core with thin NestJS delivery
around it. This split is deliberate: the core carries the identity, credential,
consent, and audit logic with no web framework, so it is unit-testable (see the smoke
test) and embeddable as a library, while NestJS only handles HTTP, wiring, and
persistence adapters.

## Layers

```
                 +---------------------------------------------------+
   HTTP / OIDC   |  NestJS controllers, guards, OIDC provider mount  |  src/<module>/
                 +---------------------------------------------------+
                                     |
                 +---------------------------------------------------+
   Core (no fw)  |  the modules under src/core/ (table below)        |  src/core/<module>/
                 +---------------------------------------------------+
                                     |
                 +---------------------------------------------------+
   Ports         |  ResidencyStore | ConsentStore | AuditStore | ... |
                 +---------------------------------------------------+
                          |                         |
                 InMemory* (tests/pilots)    Prisma* (PostgreSQL)
```

Nothing under `src/core/` imports NestJS or reaches back into the delivery layer;
`npm run lint:arch` fails the build if it does. `src/platform/` is where the application
composes the core: it loads the country configuration, builds the services and hands them to
the controllers. The store ports are implemented in memory for tests and by the `Prisma*`
classes in `src/prisma/prisma.service.ts` for PostgreSQL.

The diagrams in [ADR-0002](adr/0002-hexagonal-modular-architecture.md) show the same structure
at four levels: system context, containers, the residency component, and the credential trust
triangle.

## Core modules

All paths are under `src/core/`.

| Module | What it holds | HTTP surface (under `src/`) |
|---|---|---|
| `residency/` | The residency service and its four issuance gates, the relationship lifecycle, refusals, the Resident ID format, arrival notices, and the persistence port (`ports.ts`) | `residency/`, `federation/`, `admin/` |
| `foundational/` | Adapters to identity sources (REST, XML, imported extract, NIN, Aadhaar, MOSIP ID Authentication, OpenID Provider, mock) and the mapping layer they share | `identity/` |
| `proofing/` | Applicant binding, biometric comparison, and residence and address evidence | used by `residency/` and `upstream/` |
| `identity/` | Identity links: which identifiers belong to which person | `residency/` |
| `credentials/` | Issuing and verifying the credential in both formats (VC-JWT and Data Integrity), status lists, DID documents, signers and key custody, delivery records, federation trust | `residency/`, `vcapi/`, `credentials/` |
| `oid4vci/` | Wallet issuance over OpenID4VCI | `oid4vci/` |
| `oid4vp/` | Presentation requests and verification over OpenID4VP | `oid4vp/`, `vcapi/` |
| `offline/` | QR encoding and the USSD menu | `offline/` |
| `sso/` | Pairwise subjects, sign-in factors (credential, passkey, one-time code), sign-in assurance, and OIDC storage | `sso/` |
| `oidc/` | Sign-in at an external OpenID Provider during enrolment | `upstream/` |
| `consent/` | Consent records and receipts, and the Legal Basis Registry | `consent/` |
| `audit/` | The hash-chained audit log and the resident's access log | `audit/`, `me/` |
| `privacy/` | Erasure, retention, the compliance records and the breach register | `residency/`, `admin/` |
| `statistics/` | Non-PII aggregates with small-cell suppression | `admin/` |
| `assurance/` | The assurance registry and its profiles | `assurance/` |
| `operator/` | Operator accounts, sessions, TOTP and federated staff sign-in | `operator/`, `common/operator.guard.ts` |
| `messaging/` | The contact directory and one-time-code delivery through an SMS provider | wired in `platform/resident-messaging.ts` |
| `ratelimit/` | The key a caller is rate-limited under | `common/caller-throttler.guard.ts` |
| `config/` | The country configuration schema and ISO 3166-2 unit codes | loaded by `platform/platform.service.ts` |
| `kernel/` | Branded types and secret handling shared by the other modules | none |

Around the core, in the delivery layer and outside it:

| Concern | Where |
|---|---|
| The OpenID Connect provider (`oidc-provider` mount) | `src/sso/oidc.provider.ts`, `src/sso/oidc.module.ts`, `src/sso/interaction.controller.ts` |
| Persistence | `src/prisma/prisma.service.ts`, schema and migrations in `prisma/` |
| Security headers, key custody wiring, background jobs | `src/platform/` |
| Health, metrics and logging | `src/observability/` |
| API specification | `docs/openapi.yaml`, served by `src/meta/meta.controller.ts` at `/openapi.yaml` and `/docs` |
| Interoperability SDK | `sdk/` |
| Reference UI | `public/`, served at `/app` |
| Gateway posture | rate limiting in `src/common/`, ingress in `deploy/k8s/ingress.yaml` |

## Data flow: enroll to SSO

1. Resident submits foundational identifiers. The foundational adapter verifies against
   the national ID API and returns a NormalizedIdentity with a tokenized `subjectRef`.
   The raw national ID never leaves the adapter. This step establishes that the identity
   **record** is genuine — it does not, on its own, establish that the applicant **owns**
   it.
2. ResidencyService establishes applicant→identity binding: it combines any binding the
   provider attested (an OTP to the registered device, an eID redirect →
   `authoritative_authentication`) with any the enrolment channel performed (an agent's
   in-person comparison, a face/fingerprint match), takes the strongest, and holds it to
   the jurisdiction's `residency.applicantBinding` policy. A bare lookup binds nothing, so
   a policy with `required: true` refuses to issue on a lookup alone. See
   `core/proofing/binding.ts`.
3. ResidencyService enforces the assurance policy, mints a ResidentID, issues a signed
   VC-JWT that **asserts the binding method** in `credentialSubject.applicantBinding`,
   assigns a revocation index, and persists a minimized record. An audit event records
   which binding method was achieved.
4. A sector service verifies the credential (online or fully offline) via the verifier.
5. For SSO, the resident signs in once at the OIDC provider. On consent, a first-class
   ConsentRecord is stored, a signed receipt is minted, and an audit event is recorded.
   The ID token carries residency claims but never the national ID.

## Why these standards

Ed25519 VC-JWT keeps credentials small enough for a single QR and paper carriage, and
verifiable with one signature check offline. The same credential is also issued as a
JSON-LD Data Integrity credential (`eddsa-rdfc-2022`) for wallets that expect that format; see
[`INTEROP.md`](INTEROP.md). The Bitstring Status List lets verifiers
cache revocation and check it without a callback. OpenID Connect means any conformant
relying party integrates without bespoke work. The audit log is hash-chained so it is
tamper-evident, which is the property public-infrastructure oversight requires.
