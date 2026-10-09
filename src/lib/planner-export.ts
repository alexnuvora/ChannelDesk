export type ExportPublication = {
  id: string;
  text: string | null;
  state: string;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  publication_targets: {
    state: string;
    external_url: string | null;
    social_connections: {network: string; display_name: string | null} | null;
  }[];
};

export function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function plannerCsv(items: ExportPublication[]): string {
  const rows: unknown[][] = [['Post ID', 'Caption', 'Status', 'Scheduled time (UTC)', 'Created time (UTC)', 'Network', 'Account', 'Delivery status', 'Published URL']];
  for (const item of items) {
    const targets = item.publication_targets.length ? item.publication_targets : [null];
    for (const target of targets) rows.push([
      item.id, item.text, item.state, item.scheduled_for, item.created_at,
      target?.social_connections?.network, target?.social_connections?.display_name,
      target?.state, target?.external_url,
    ]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const calendarText = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// RFC 5545 limits content lines to 75 octets, not 75 characters.
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let result = '', size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) { result += '\r\n '; size = 1; }
    result += char;
    size += bytes;
  }
  return result;
}

export function plannerCalendar(items: ExportPublication[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChannelDesk//Content Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const item of items) {
    // Unscheduled drafts are never assigned a fabricated posting time.
    if (!item.scheduled_for || !Number.isFinite(Date.parse(item.scheduled_for))) continue;
    const channels = item.publication_targets.map(t => t.social_connections?.display_name || t.social_connections?.network).filter(Boolean).join(', ');
    const description = [item.text || 'Social post', `Status: ${item.state.replaceAll('_', ' ')}`, channels ? `Accounts: ${channels}` : ''].filter(Boolean).join('\n');
    const status = item.state === 'cancelled' ? 'CANCELLED' : ['scheduled', 'publishing', 'published'].includes(item.state) ? 'CONFIRMED' : 'TENTATIVE';
    lines.push('BEGIN:VEVENT', `UID:${item.id}@channeldesk`, `DTSTAMP:${stamp(now.toISOString())}`, `LAST-MODIFIED:${stamp(item.updated_at)}`, `DTSTART:${stamp(item.scheduled_for)}`, `SUMMARY:${calendarText((item.text || 'Social post').split(/\r?\n/)[0].slice(0, 120))}`, `DESCRIPTION:${calendarText(description)}`, `STATUS:${status}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
