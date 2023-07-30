import { expect, it, vi } from 'vitest';
import { RequestMap } from '../src/RequestMap';
import { defer, wait } from './util';

it('deduplicates requests with the same key', async () => {
  const map = new RequestMap();
  const fetch = vi.fn().mockResolvedValue('data');
  const cb1 = vi.fn();
  const cb2 = vi.fn();

  map.request('a', cb1, fetch);
  map.request('a', cb2, fetch);

  await wait();

  expect(fetch).toHaveBeenCalledOnce();
  expect(cb1).toHaveBeenCalledWith(null, 'data');
  expect(cb2).toHaveBeenCalledWith(null, 'data');
});

it('does not deduplicate requests with different key', async () => {
  const map = new RequestMap();
  const cb1 = vi.fn();
  const cb2 = vi.fn();

  let i = 0;
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(i++));

  map.request('a', cb1, fetch);
  map.request('b', cb2, fetch);

  await wait();

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(cb1).toHaveBeenCalledWith(null, 0);
  expect(cb2).toHaveBeenCalledWith(null, 1);
});

it('gives stale value and re-requests', async () => {
  const map = new RequestMap({ ttl: 0 });
  const cb = vi.fn();
  const fetch = defer();

  map.request(
    'a',
    () => {},
    () => Promise.resolve('stale'),
  );

  await wait();

  map.request('a', cb, () => fetch.promise);

  await wait();

  expect(cb).toHaveBeenCalledWith(null, 'stale', true);

  fetch.resolve('data');

  await wait();

  expect(cb).toHaveBeenCalledWith(null, 'data');
});

it('gets and sets cached values', async () => {
  const cache = {
    get: vi.fn().mockReturnValue('cached'),
    set: vi.fn(),
  };

  const map = new RequestMap({ ttl: 1000, cache });
  const cb = vi.fn();
  const fetch = defer();

  map.request('a', cb, () => fetch.promise);

  await wait();

  expect(cache.get).toHaveBeenCalledWith('a');
  expect(cb).toHaveBeenCalledWith(null, 'cached', true);

  fetch.resolve('data');

  await wait();

  expect(cache.set).toHaveBeenCalledWith('a', 'data');
  expect(cb).toHaveBeenCalledWith(null, 'data');
});

it('gives promised cached value', async () => {
  const cache = {
    get: vi.fn().mockResolvedValue('cached'),
    set: vi.fn(),
  };

  const map = new RequestMap({ ttl: 1000, cache });
  const cb = vi.fn();
  const fetch = defer();

  map.request('a', cb, () => fetch.promise);

  await wait();

  expect(cb).toHaveBeenCalledWith(null, 'cached', true);

  fetch.resolve('data');

  await wait();

  expect(cb).toHaveBeenCalledWith(null, 'data');
});

it("doesn't give cached value if request is quicker", async () => {
  const cached = defer();

  const cache = {
    get: () => cached.promise,
    set: vi.fn(),
  };

  const fetcher = new RequestMap({
    ttl: 1000,
    cache,
  });

  const cb = vi.fn();

  fetcher.request('a', cb, () => Promise.resolve('data'));

  await wait();

  expect(cb).toHaveBeenCalledWith(null, 'data');

  cached.resolve('cached');

  await wait();

  expect(cb).toHaveBeenCalledOnce();
});

it('updates all observers when invalidated', async () => {
  let i = 0;
  const map = new RequestMap();
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(i++));
  const cb1 = vi.fn();
  const cb2 = vi.fn();

  map.request('a', cb1, fetch);
  map.request('a', cb2, fetch);
  await wait();

  await map.invalidate('a');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(cb1).toHaveBeenCalledWith(null, 1);
  expect(cb2).toHaveBeenCalledWith(null, 1);
});

it('passes error to callback when fetch is rejected', async () => {
  const map = new RequestMap();
  const cb = vi.fn();

  map.request('a', cb, () => Promise.reject('error'));

  await wait();

  expect(cb).toHaveBeenCalledWith('error');
});

it('unsubscribes and deletes request', async () => {
  const map = new RequestMap();

  const u1 = map.request(
    'a',
    () => {},
    () => Promise.resolve(),
  );

  const u2 = map.request(
    'a',
    () => {},
    () => Promise.resolve(),
  );

  map.request(
    'b',
    () => {},
    () => Promise.resolve(),
  );

  expect(map.entries.size).toBe(2);
  expect(map.entries.get('a')?.observers).toHaveLength(2);
  u1();
  expect(map.entries.get('a')?.observers).toHaveLength(1);
  u2();
  expect(map.entries.size).toBe(1);
});
