import test from 'node:test';
import assert from 'node:assert/strict';
import {FileSession,sameOriginFileUrl} from '../cad-viewer/file-session.js';

test('rapid switching aborts the previous fetch and rejects stale completion',()=>{
  const session=new FileSession();const first=session.begin({name:'first.step'});const second=session.begin({name:'second.dwg'});
  assert.equal(first.controller.signal.aborted,true);assert.equal(session.isCurrent(first),false);assert.equal(session.isCurrent(second),true);
});
test('cancel invalidates pending reads and a later request can still finish',()=>{
  const session=new FileSession();const first=session.begin({name:'first.dwg'});session.cancel();
  assert.equal(session.isCurrent(first),false);assert.equal(first.controller.signal.aborted,true);
  const next=session.begin({name:'next.step'});assert.equal(session.isCurrent(next),true);
});
test('server-file opening accepts encoded same-origin paths and rejects external URLs',()=>{
  assert.equal(sameOriginFileUrl('/drawings/a%20b.dwg','https://example.test/viewer/'),'https://example.test/drawings/a%20b.dwg');
  assert.throws(()=>sameOriginFileUrl('https://other.test/a.dwg','https://example.test/viewer/'));
  assert.throws(()=>sameOriginFileUrl('javascript:alert(1)','https://example.test/viewer/'));
});
