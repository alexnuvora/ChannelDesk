import test from 'node:test';
import assert from 'node:assert/strict';
import {smartLinkDestination,referrerOrigin} from '../src/lib/smart-link-url';
test('public link destinations cannot execute scripts, include credentials or header controls',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,<h1>hi</h1>','https://user:password@example.com','https://example.com\r\nX-Test:bad','/relative','ftp://example.com'])assert.equal(smartLinkDestination(value),null);
 assert.equal(smartLinkDestination('https://example.com/path?campaign=social'),'https://example.com/path?campaign=social');
 assert.equal(referrerOrigin('https://example.com/private?access_token=secret'),'https://example.com');
});
