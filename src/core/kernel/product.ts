// SPDX-License-Identifier: Apache-2.0

/**
 * The name this software goes by where a deployment has not supplied its own.
 *
 * A jurisdiction's config names the authority a resident is dealing with
 * (`credential.issuerName`), and that is what a person should see on a message, a menu or
 * a passkey prompt. This is only the fallback for the places that can run before, or
 * without, a config: the operators' authenticator entry, the one-time-code sender built
 * with no issuer, the USSD menu header, the API documentation page.
 *
 * It lived as the same literal in eight files, which is how a rename reaches seven of them.
 */
export const PRODUCT_NAME = 'OpnResidex';
