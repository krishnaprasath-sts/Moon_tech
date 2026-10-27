/**
 * Public customer number shown to the customer and to staff, e.g. MT100042.
 * Derived from the user id (100000 + id, zero-padded to 6 digits) so it is unique
 * without a separate counter and the same for a given account forever.
 */
export const CUSTOMER_ID_PREFIX = 'MT';

export function customerIdFor(userId: number): string {
  return `${CUSTOMER_ID_PREFIX}${String(100000 + Math.floor(Number(userId) || 0)).padStart(6, '0')}`;
}
