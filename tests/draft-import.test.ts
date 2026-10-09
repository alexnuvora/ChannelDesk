import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDraftCsv} from '../src/lib/draft-import';
test('draft imports preserve quoted commas, line breaks, Unicode and escaped quotes',()=>{
 assert.deepEqual(parseDraftCsv('\uFEFFcaption,notes\r\n"Hello, world\nwith ""quotes"" 😀",idea\r\n'),[{caption:'Hello, world\nwith "quotes" 😀',row:2}]);
});
test('draft imports reject ambiguous schedules, malformed rows and unbounded input',()=>{
 for(const input of ['caption,date\nx,2026-10-09','caption,caption\nx,x','caption\n"unclosed','caption\n"x"trailing','caption\n"x""','caption\n','caption\nx,y','caption\n'+ 'x'.repeat(2201),'caption\n'+Array(101).fill('x').join('\n')])assert.throws(()=>parseDraftCsv(input));
 assert.throws(()=>parseDraftCsv('caption\n'+'x'.repeat(256*1024)),/256 KB/);
});
