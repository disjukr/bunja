import { createScreenFactory, createSearch } from './proposed.ts';
function assert(v: unknown) { if (!v) throw new Error('assertion failed'); }
Deno.test('screens isolate filters, endpoints, persistence and replacement', async () => {
  const writes = new Map<string,string>(), urls: string[] = [];
  const storage = { setItem: (k:string,v:string) => { writes.set(k,v); } };
  const fetcher = async (url:string) => { urls.push(url); return url; };
  const a = createScreenFactory({endpoint:'a',storage,storageKey:'filter:one',fetcher})();
  const b = createScreenFactory({endpoint:'b',storage,storageKey:'filter:two',fetcher})();
  a.setFilter('red'); b.setFilter('blue'); await a.load(); await b.load();
  assert(urls.join() === 'a?q=red,b?q=blue');
  assert(writes.get('filter:one') === 'red' && writes.get('filter:two') === 'blue');
  const preview = new Map<string,string>();
  const c = createScreenFactory({endpoint:'c', storage:{setItem:(k,v)=>{preview.set(k,v);}},storageKey:'filter:one',fetcher})();
  c.setFilter('green'); await c.load(); await a.load();
  assert(preview.get('filter:one') === 'green' && writes.get('filter:one') === 'red');
  assert(urls.slice(-2).join() === 'c?q=green,a?q=red');
});
function fixture() {
  const requests: ReturnType<typeof Promise.withResolvers<string>>[] = [];
  const rpc = {load() { const d = Promise.withResolvers<string>(); requests.push(d); return d.promise; }};
  return {rpc,requests};
}
Deno.test('newest success wins and newest failure is visible; success clears error', async () => {
  const f = fixture(), s = createSearch(f.rpc), stop = s.mount();
  const old = s.refresh(), recent = s.refresh();
  f.requests[1].resolve('new'); await recent;
  f.requests[0].resolve('old'); await old; assert(s.snapshot().result === 'new');
  const stale = s.refresh(), failed = s.refresh(), cause = new Error('current');
  f.requests[3].reject(cause); await failed;
  f.requests[2].reject(new Error('stale')); await stale;
  assert(s.snapshot().error === cause && s.snapshot().result === 'new');
  const ok = s.refresh(); f.requests[4].resolve('recovered'); await ok;
  assert(s.snapshot().error === undefined && s.snapshot().result === 'recovered'); stop();
});
Deno.test('late success and failure ignored across cleanup/remount; shared rpc stays usable', async () => {
  const f = fixture(), s = createSearch(f.rpc), other = createSearch(f.rpc);
  const stop = s.mount(), stopOther = other.mount();
  const success = s.refresh(), failure = s.refresh(); stop(); const stopAgain = s.mount();
  f.requests[0].resolve('late'); f.requests[1].reject(new Error('late')); await Promise.all([success,failure]);
  assert(s.snapshot().result === '' && s.snapshot().error === undefined);
  const current = s.refresh(), independent = other.refresh();
  f.requests[2].resolve('current'); f.requests[3].resolve('other'); await Promise.all([current,independent]);
  assert(s.snapshot().result === 'current' && other.snapshot().result === 'other');
  const disposed = s.refresh(); stopAgain(); f.requests[4].reject(new Error('disposed')); await disposed;
  assert(s.snapshot().error === undefined); stopOther();
});
