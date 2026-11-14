// FR5: after login the user goes back to `returnTo`. Only a path on this site is accepted,
// so a crafted link cannot send the user to another address.
export function safeReturnTo(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
