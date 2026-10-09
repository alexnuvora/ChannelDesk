import test from 'node:test';
import assert from 'node:assert/strict';
import {localScheduleInstant} from '../src/lib/planner-dates';
test('local rescheduling rejects invalid, normalized and past dates',()=>{
  const previous=process.env.TZ;process.env.TZ='Europe/London';
  try {
    const now=Date.parse('2026-01-01T00:00:00Z');
    assert.throws(()=>localScheduleInstant('2026-03-29T01:30',now),/clocks change/);
    assert.throws(()=>localScheduleInstant('2026-02-30T12:00',now));
    assert.throws(()=>localScheduleInstant('2026-01-01T00:00',now),/future/);
    assert.throws(()=>localScheduleInstant('2026-10-09',now),/valid/);
    assert.equal(localScheduleInstant('2026-07-01T12:00',now),'2026-07-01T11:00:00.000Z');
  } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
