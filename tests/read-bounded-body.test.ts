import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedBody} from '../src/lib/read-bounded-body';
test('body limits are enforced while streaming, even without a Content-Length header',async()=>{
 const chunks=[new Uint8Array(4),new Uint8Array(4)];let sent=0;
 const stream=new ReadableStream<Uint8Array>({pull(controller){if(sent<chunks.length)controller.enqueue(chunks[sent++]);else controller.close()}});
 await assert.rejects(()=>readBoundedBody(new Request('https://example.com',{method:'POST',body:stream,duplex:'half'} as RequestInit),7),/too large/);
 assert.equal(await readBoundedBody(new Request('https://example.com',{method:'POST',body:'hello'}),5),'hello');
});
