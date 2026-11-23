// SPDX-License-Identifier: Apache-2.0
/**
 * The one place a subject pepper is resolved when a caller did not supply one.
 *
 * ## Why this exists (OR-01)
 *
 * Seven construction sites each carried their own
 * `process.env.SUBJECT_PEPPER ?? 'dev-pepper'`. `PlatformService` already
 * refuses to boot when `NODE_ENV=production` and the variable is unset, and the
 * reasoning there is the authority on why: foundational identifiers are
 * low-entropy (an 11-digit NIN is ~10^11 candidates), so a *known* pepper does
 * not merely weaken the tokenization — it makes every `subjectRef` in the
 * register enumerable offline, and the same pepper derives pairwise OIDC
 * subjects, so recovering it also collapses the cross-service correlation
 * defence. Neither guarantee can be restored afterwards, because rotating the
 * pepper invalidates every stored `subjectRef`.
 *
 * That boot guard covers the registry path, which is the only path in the tree
 * today: `FoundationalRegistry` takes `pepper: string` and passes it to every
 * factory, so the per-adapter defaults never fire. They were a **latent
 * bypass** — any adapter constructed outside the registry, by a future caller
 * or a test, silently got the published constant and produced `subjectRef`s
 * indistinguishable from real ones. Nothing in the tree relied on them: all
 * eleven construction sites pass a pepper, and no test constructs an adapter at
 * all.
 *
 * So the fallback is replaced by a refusal rather than deleted outright. A
 * missing pepper is now a loud failure at the point of construction instead of
 * a quiet downgrade that surfaces, if ever, as un-reversible data already
 * written under a public key.
 *
 * Deliberately NOT keyed on `NODE_ENV`: the boot guard is, and that is the gap
 * this closes. A development box with no pepper should be told to set one, not
 * handed a value that makes its data look production-shaped.
 */
export function requireSubjectPepper(): string {
  const pepper = process.env.SUBJECT_PEPPER;

  if (!pepper) {
    throw new Error(
      'Refusing to construct a foundational adapter with no subject pepper. ' +
        'SUBJECT_PEPPER is unset and there is no fallback: the previous ' +
        "default ('dev-pepper') is published in this source, so every " +
        'subjectRef derived from it is reproducible by anyone and pairwise ' +
        'OIDC subjects are no longer unlinkable. Set SUBJECT_PEPPER to a ' +
        'high-entropy deployment secret (openssl rand -hex 32) and keep it — ' +
        'rotating it invalidates every subjectRef already stored. Adapters ' +
        'built through FoundationalRegistry are given the deployment pepper ' +
        'and never reach this.',
    );
  }

  return pepper;
}
