import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RequestMap, Requester } from './RequestMap';

const context = createContext(new RequestMap());
export const RequestMapProvider = context.Provider;

export function useRequestMap() {
  return useContext(context);
}

export function useRequest<T>(key: string | null, request: Requester<T>) {
  const requestRef = useRef(request);
  const mounted = useRef(true);
  const map = useRequestMap();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!key) return;

    return map.request(
      key,
      (err, data, stale) => {
        // don't update the state if we've unmounted
        if (!mounted.current) return;

        if (err) {
          setError(err);
        } else {
          setData(data);
        }
        if (!stale) {
          setLoading(false);
        }
      },
      requestRef.current,
    );
  }, [key, map]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    data,
    error,
    loading,
  };
}
