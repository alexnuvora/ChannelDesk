import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell, plannerCsv, plannerCalendar, foldCalendarLine, type ExportPublication} from '../src/lib/planner-export';

const post: ExportPublication = {id: '11111111-1111-4111-8111-111111111111', text: 'A caption, with "quotes"\nand another line', state: 'scheduled', scheduled_for: '2026-10-25T01:30:00+01:00', created_at: '2026-10-09T09:00:00Z', updated_at: '2026-10-09T10:00:00Z', publication_targets: [{state: 'scheduled', external_url: null, social_connections: {network: 'youtube', display_name: 'Our channel'}}]};

test('calendar export preserves timezone-qualified instants across daylight saving changes', () => {
  const calendar = plannerCalendar([post], new Date('2026-10-09T10:00:00Z'));
  assert.match(calendar, /DTSTART:20261025T003000Z/);
  assert.match(calendar, /UID:11111111-1111-4111-8111-111111111111@channeldesk/);
  assert.match(calendar, /STATUS:CONFIRMED/);
  assert.match(calendar, /TRANSP:TRANSPARENT/);
});

test('unscheduled drafts are excluded from calendar files but retained in CSV exports', () => {
  const draft = {...post, state: 'draft', scheduled_for: null, publication_targets: []};
  assert.equal(plannerCalendar([draft]).includes('BEGIN:VEVENT'), false);
  const csv = plannerCsv([draft]);
  assert.match(csv, /"draft"/);
  assert.match(csv, /A caption, with ""quotes""/);
});

test('CSV neutralizes spreadsheet formulas in captions and account names', () => {
  for (const value of ['=HYPERLINK("https://example.com")', '+1+1', '-cmd', '@SUM(1)', '\t=1+1', '\r\n=1']) assert(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('normal "name"'), '"normal ""name"""');
  assert.match(plannerCsv([{...post, text: '=1+1'}]), /"'=1\+1"/);
});

test('calendar text cannot inject additional events and UTF-8 folding stays within 75 octets', () => {
  const hostile = {...post, text: 'hello\r\nBEGIN:VEVENT\r\nSUMMARY:injected; 😀'.repeat(8)};
  const calendar = plannerCalendar([hostile]);
  assert.equal(calendar.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  for (const line of calendar.split('\r\n')) assert(Buffer.byteLength(line, 'utf8') <= 75);
  assert.equal(foldCalendarLine('😀'.repeat(80)).replaceAll('\r\n ', ''), '😀'.repeat(80));
});

test('cancelled and uncertain deliveries retain honest calendar status', () => {
  assert.match(plannerCalendar([{...post, state: 'cancelled'}]), /STATUS:CANCELLED/);
  assert.match(plannerCalendar([{...post, state: 'needs_review'}]), /STATUS:TENTATIVE/);
  assert.equal(plannerCsv([{...post, publication_targets: [...post.publication_targets, ...post.publication_targets]}]).split('"youtube"').length - 1, 2);
});
