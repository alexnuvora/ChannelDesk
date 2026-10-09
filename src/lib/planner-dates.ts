/** Parse a wall-clock time without silently moving nonexistent DST times. */
export function localScheduleInstant(value: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid date and time.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose a valid date and time.');
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (local !== value) throw new Error('This local time does not exist because the clocks change. Choose another time.');
  if (date.getTime() <= now + 60000) throw new Error('Choose a time at least one minute in the future.');
  return date.toISOString();
}
