export function reportRange(params: URLSearchParams, now = new Date()) {
  const from = params.get('from'), to = params.get('to');
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (from || to) {
    if (!from || !to || !validDate(from) || !validDate(to)) throw new Error('Choose valid start and end dates.');
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (days < 1 || days > 90) throw new Error('Choose a date range between 1 and 90 days.');
    if (to > now.toISOString().slice(0, 10)) throw new Error('Reports cannot include future dates.');
    return {from, to, days};
  }
  const days = Number(params.get('days') || 30);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('days must be an integer between 1 and 90');
  const start = new Date(now);start.setUTCHours(0, 0, 0, 0);start.setUTCDate(start.getUTCDate() - days + 1);
  return {from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), days};
}
