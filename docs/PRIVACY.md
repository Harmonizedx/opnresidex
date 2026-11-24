# Data protection

How OpnResidex handles personal data, what a deployer must decide, and what the software
enforces on their behalf.

This is a statement about **the software**. A deployment is a data controller in its own
right: the Katsina State Residency Authority, not this repository, decides lawful basis,
retention periods and disclosure policy. What follows describes what the software does, so a
controller can write their own notice on top of it without reverse-engineering the code.

Written against the six privacy requirements the Digital Public Goods Alliance added to the
DPG Standard in 2024.

## 1. What is collected, and what is deliberately not

| Held | Notes |
| --- | --- |
| A tokenized `subjectRef` | HMAC of provider + national ID under a per-deployment pepper. One-way, and not correlatable with another deployment's reference for the same person. |
| `residentId` | Pseudonymous, semi-public by design — printed on cards, carried in QR codes. |
| Minimized demographics | Name, date of birth, gender — only what the credential asserts. |
| Jurisdiction, assurance, binding method, residence evidence level | The decision inputs, so a determination can be explained. |
| Phone number | Only when `contactDirectory.mode` is `encrypted`: AES-256-GCM ciphertext under a key held outside the database, plus a one-way hash for matching. Under `external` or `none`, only the hash. |
| Residence address | Only where the jurisdiction anchors residency on an address ([ADR-0011](adr/0011-residency-anchor-is-a-jurisdiction-choice.md)). Otherwise the administrative unit alone. |
| Residence mode and attester type | Where a jurisdiction admits registration without a fixed address: which mode was used and what kind of attester vouched. |
| Refusal records | For an application that was refused: the reference handed to the applicant, the reason, the operators who took and decided it, and any review outcome. Carries the tokenized `subjectRef` only where an identity was established, and no name. |
| Identity links | Which identifiers belong to the person: the identifier type and a reference to it (the foundational identifier is tokenized, never the number), evidence references, and who linked, disputed or unlinked it. |
| Consent records | Relying party, purpose, scopes, data categories, legal basis and the evidence of agreement. |
| Credential delivery events | Channel, outcome, time and the recording operator. |
| Passkeys | Where a resident enrols one: the credential id, public key and signature counter. No biometric leaves the resident's device. |
| One-time codes | A hash of the code and its expiry, never the code. |
| Arrival notices | For a resident who moves between federated jurisdictions: the peer's identifier, the credential id and a hash of the presentation. |
| Operator accounts | About staff, not residents: email, display name and roles; under `operatorAuth.mode: local` also a password hash and TOTP secret. API keys are stored as hashes. |
| Breach register | Entries a controller records after a breach: categories of data, a description and the number of people affected. |

**Never held:** the raw national identification number. It reaches the foundational adapter,
is tokenized, and does not survive the call. It is never stored, never logged, never returned
in a response, and never placed in a credential or an SSO claim.

## 2. Data minimisation

Enforced structurally rather than by policy. The aggregate statistics export
(`src/core/statistics/*`) consumes a projection type that has no name, date-of-birth, gender,
contact, `residentId` or `subjectRef` field on it, so a personal attribute cannot reach a
published statistic — there is one narrowing point to review rather than a rule to remember.
Contact details are deliberately kept off the residency port entirely, so the core residency
service has no capability to touch a phone number.

## 3. Consent

Consent is a first-class, revocable record with a signed, portable receipt the resident keeps.
Grant, inspect, withdraw, expire and audit are all supported.

**Expiry is enforced, not merely recorded.** A consent granted with a validity period stops
authorising disclosure the moment it lapses, on every read path, and the stored record
converges to `expired` rather than sitting `active` while behaving otherwise. Withdrawal also
revokes the OIDC grant it authorised, so tokens already issued stop releasing claims.

Consent is one lawful basis among several. Where a deployment processes under statutory
authority instead, that is a different basis and must be recorded as such: declare it under
`dataProtection.legalBases`, so it resolves through the Legal Basis Registry
([ADR-0009](adr/0009-legal-basis-registry-closed-vocabulary.md)).

## 4. Erasure

`POST /residency/{residentId}/erase` (operator, `admin` role).

Erasure and a tamper-evident register pull in opposite directions: the resident may require
their data destroyed, and the register must be able to show nothing was quietly rewritten.
Deleting rows satisfies the first and destroys the second. The resolution is that erasure
removes **the person**, not the record that a transaction occurred:

1. **The credential is revoked first.** Order matters — erasing first would leave a credential
   in a wallet that still verifies against a register no longer able to say whose it is.
2. **Every identifying field is destroyed**: names, date of birth, gender, phone hash and
   ciphertext, and the `subjectRef` linking the record to a foundational identity. The
   `subjectRef` is overwritten with a unique random tombstone, so the record can never again
   match a lookup and the same person re-enrolling is correctly treated as new.
3. **Audit events naming the subject are redacted, not deleted.** The rows and their hashes
   remain, the plaintext goes, and each redaction is appended as its own chained event naming
   who performed it, why, and under what legal basis.

**The audit chain still verifies after erasure**, and reports how many events were redacted
rather than concealing it. A redacted event's stored hash still commits to its original
content, so anyone holding an earlier copy of the log can prove what it said. Editing an event
*without* redacting it is still detected as tampering.

### What survives, and why

A hollow row remains, carrying `residentId`, `statusListIndex` and `erasedAt`. Each is kept
for a specific reason, and dropping any of them would be a defect:

- **`statusListIndex` must never be reused.** Reissuing an erased person's index would hand
  their revocation bit to the next resident enrolled.
- **The credential must stay revoked.** A revocation whose record is deleted is a revocation
  that can be forgotten.
- **`residentId` appears in chained audit events.** Removing it there is redaction, not
  deletion, for the integrity reason above.

What remains is an opaque identifier with no name, no contact, no link to a national ID, and a
revoked credential. A controller who wants the row gone entirely may delete it once its
retention period has expired **and** the status list has been rotated — a deliberate,
documented operation, never a default.

## 5. Retention

Configured per jurisdiction under `residency.retention`, and enforced by a sweep an operator
runs: `POST /residency/retention/sweep` (`admin` role).

| Setting | Meaning |
| --- | --- |
| `residencyDays` | Days to keep a residency record, from creation. `null` = keep indefinitely. |
| `legalHold` | Suspends retention deletion entirely. |

**The shipped default expires nothing.** A retention period is a controller's decision against
their own law, and a default number here would be this software quietly setting policy for a
government — wrong in both directions, since too short destroys records a resident needs for an
appeal and too long is itself a breach.

**The sweep is a dry run unless you pass `confirm: true`.** It returns exactly which residents
would be erased, so a bulk irreversible operation on other people's records is decided with the
list in hand rather than discovered afterwards. Each record it does erase goes through the same
path as a single erasure: credential revoked first, identifying fields destroyed, audit entries
redacted with the chain still verifying.

**A legal hold stops the sweep entirely** rather than reasoning about which records an open
appeal or a regulator's request might implicate — deleting the evidence an appeal turns on is
the failure this prevents, and a partial sweep is worse than none.

A held or unset policy is reported as `skipped`, never as an empty success. "Nothing was due"
and "retention is switched off" look identical otherwise, and a controller who believes a sweep
ran when it was held is badly misled.

**Not covered:** consent records and audit events have no automatic expiry. Only residency
records are swept.

## 6. Access control and audit

Role-scoped operator identity with per-operator API keys and rotation; privileged reads are
attributed to a named person, not a shared key. Every privileged action is recorded in an
append-only, hash-chained log. Erasure requires `admin` — a stricter role than revocation,
because a caller who can erase can also destroy evidence of their own earlier actions, which
is why the redaction record names them.

## 7. Subject rights

| Right | Mechanism |
| --- | --- |
| Access | `GET /consent/resident/{residentId}`, `GET /residency/{residentId}` |
| Know who accessed the record | `POST /me/access-log`, after the resident proves themselves with their credential, a USSD session or a one-time code. Staff are reduced to a kind; relying parties are named. |
| Human review of a refusal | `GET /residency/refusals/{reference}` for the reason and appeal path; `POST /residency/refusals/{reference}/review` records the reviewer's outcome, which may overturn it |
| Rectification of linked identifiers | The dispute, unlink and relink routes under identity links (`docs/API.md`) |
| Portability | Consent receipts are signed, portable JWTs the resident holds; the credential itself is a portable W3C VC |
| Erasure | `POST /residency/{residentId}/erase` |
| Withdraw consent | `POST /consent/{id}/revoke` — blocks future consent-dependent disclosure and revokes the associated OIDC grant |

## 8. Known gaps

Stated because a privacy notice that omits them is worth less than one that does not.

- **Audit events do not carry purpose or legal basis.** The log establishes that a disclosure
  happened and that the record of it has not been altered, but not the basis it was made
  under. Tracked as G-10.
- **A federated peer publishing an unsigned status list will not sync**, so presentations of
  its credentials fail closed until it publishes a signed one or the deployment explicitly
  opts in per peer. This is deliberate — see `docs/INTEROP.md`.
- **Retention covers residency records only.** Consent records and audit events have no
  automatic expiry, and no scheduler runs the sweep — an operator triggers it.

## 9. What a deployer must complete

Start from what the system can state about itself: `GET /admin/compliance/ropa` and
`GET /admin/compliance/dpia` generate the record of processing and the impact-assessment facts
from the live configuration, labelled as skeletons with every unknown listed to complete, and
`docs/templates/SCHEDULE-6-VULNERABILITY-CHECKLIST.md` covers the vulnerable-subject indexes.

- A Data Protection Impact Assessment against governing law (for Nigeria, the Nigeria Data
  Protection Act) and a record of processing activities. Templates: `docs/templates/`.
- Retention periods for §5, who may set a legal hold, and who runs the sweep and how often.
- The lawful basis for the foundational-identity check, agreed with the identity authority.
- A published privacy notice for residents, which may cite this document but should not
  substitute for it — this describes software, not a controller's practice.
- A disclosure review before publishing the aggregate statistics export as open data.