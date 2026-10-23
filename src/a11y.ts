/** Keyboard helpers for the wallet dialog. Pure so they can be unit tested. */

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Next focus position when cycling inside a dialog. Focus never leaves the
 * range [0, count): Tab on the last element wraps to the first and Shift+Tab on
 * the first wraps to the last. When focus is outside the list (-1) it enters at
 * the first element, or the last for Shift+Tab.
 */
export function cycleFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (current < 0 || current >= count) return backwards ? count - 1 : 0
  return backwards ? (current - 1 + count) % count : (current + 1) % count
}
