import test from 'node:test';
import assert from 'node:assert/strict';
import {reportRange} from '../src/lib/report-range';
const now=new Date('2026-10-09T15:00:00Z');
test('reports use inclusive UTC ranges without future snapshots',()=>{
 assert.deepEqual(reportRange(new URLSearchParams('days=7'),now),{from:'2026-10-03',to:'2026-10-09',days:7});
 assert.deepEqual(reportRange(new URLSearchParams('from=2026-02-01&to=2026-02-28'),now),{from:'2026-02-01',to:'2026-02-28',days:28});
 for(const q of ['days=0','days=91','days=NaN','from=2026-02-30&to=2026-03-02','from=2026-01-01','from=2026-10-10&to=2026-10-11','from=2026-10-09&to=2026-10-01','from=2026-01-01&to=2026-10-01'])assert.throws(()=>reportRange(new URLSearchParams(q),now));
});
