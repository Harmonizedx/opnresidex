// SPDX-License-Identifier: Apache-2.0
import { ContactDirectory, MessagingProvider } from './types';
import type { OtpSender } from '../sso/otp';
import { PRODUCT_NAME } from '../kernel/product';

/**
 * The OtpSender the platform actually wires: resolve the resident's number through the
 * contact directory, then hand the message to the configured aggregator.
 *
 * Two properties matter here and are easy to get wrong:
 *
 * 1. The code is never logged. Only the masked destination and the resulting channel are.
 *    The whole point of replacing the previous logging stub was to stop live one-time
 *    codes appearing in the service log, so this module must not reintroduce them -- not
 *    in a success line, and not in an error path.
 *
 * 2. A delivery failure is not silently swallowed. It raises, so the caller records a
 *    failed audit event and the citizen is told to try again, rather than being left
 *    waiting for a code that was never sent. The controller above still answers the
 *    citizen identically whether or not the residency ID exists, so this does not
 *    reintroduce an enumeration oracle.
 */
export class MessagingOtpSender implements OtpSender {
  constructor(
    private provider: MessagingProvider,
    private directory: ContactDirectory,
    private messageTemplate = 'Your {issuer} sign-in code is {code}. It expires in 5 minutes. Do not share it.',
    private issuerName = PRODUCT_NAME,
  ) {}

  async send(residentId: string, code: string): Promise<{ channel: string }> {
    const to = await this.directory.lookup(residentId);
    if (!to) {
      // No number on file. This is a configuration or enrolment gap, not an attack, and it
      // is worth surfacing loudly -- otherwise sign-in fails for that citizen with no
      // explanation anywhere.
      // The id is caller-supplied on some paths, so it is URL-encoded before it reaches a
      // log line: no line break or control character can forge an entry, and a well-formed
      // id (letters, digits, hyphens) is unchanged and legible to the operator reading it.
      const safeId = encodeURIComponent(String(residentId).replace(/\n|\r/g, '')).slice(0, 64);
      // eslint-disable-next-line no-console
      console.warn(
        `[otp] No contact number for resident ${safeId}; one-time code not sent. ` +
          `Check the contact directory configuration.`,
      );
      throw new Error('NO_CONTACT_ON_FILE');
    }

    const body = this.messageTemplate
      .replace(/\{code\}/g, code)
      .replace(/\{issuer\}/g, this.issuerName);

    const result = await this.provider.send({ to, body, kind: 'otp' });
    // Nothing about the message is logged here: not the number, masked or otherwise, and
    // not the provider's id for it. The channel goes back to the caller, and the delivery
    // itself is the provider's record.
    // eslint-disable-next-line no-console
    console.log('[otp] one-time code handed to the messaging provider');
    return { channel: result.channel };
  }
}
