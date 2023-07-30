import { expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRequest } from '../src/useDataFetcher';
import { defer, wait } from './util';

it('should return the data', async () => {
  const fetch = defer();

  const { result } = renderHook(() => useRequest('a', () => fetch.promise));

  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBe(undefined);

  fetch.resolve('data');
  await wait();

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toEqual('data');
});

it('should return the error', async () => {
  const fetch = defer();

  const { result } = renderHook(() => useRequest('b', () => fetch.promise));

  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBe(undefined);

  fetch.reject('error');
  await wait();

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toEqual('error');
});
