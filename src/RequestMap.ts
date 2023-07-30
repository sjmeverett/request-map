export type RequestMapObserver<T> = (
  err: unknown,
  data?: T,
  stale?: boolean,
) => void;

export type Requester<T> = () => Promise<T>;

export interface RequestMapOptions<T> {
  ttl?: number;
  cache?: RequestCache<T>;
}

export interface RequestCache<T> {
  get(key: string): T | Promise<T>;
  set(key: string, data: T): void;
}

interface Entry<T> {
  request: Requester<T>;
  data: T | null;
  lastUpdated: number;
  observers: RequestMapObserver<T>[];
}

const DEFAULT_TTL = 1000;

export class RequestMap<T = any> {
  public entries = new Map<string, Entry<T>>();
  private pendingRequests = new Set<string>();

  constructor(public options: RequestMapOptions<T> = {}) {}

  request(key: string, observer: RequestMapObserver<T>, request: Requester<T>) {
    const entry = this.ensureKey(key, request);
    entry.observers.push(observer);

    const stale =
      Date.now() - entry.lastUpdated > (this.options.ttl ?? DEFAULT_TTL);

    if (entry.data !== null) {
      observer(null, entry.data, stale);
    } else {
      this.getCached(key, observer);
    }

    if (stale && !this.pendingRequests.has(key)) {
      void this.invalidate(key);
    }

    return () => {
      entry.observers = entry.observers.filter((x) => x !== observer);

      if (entry.observers.length === 0) {
        this.entries.delete(key);
      }
    };
  }

  async invalidate(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;

    await this._invalidate(key, entry);
  }

  private async _invalidate(key: string, entry: Entry<T>) {
    try {
      this.pendingRequests.add(key);

      const data = await entry.request();
      this._set(key, entry, data);
    } catch (err) {
      entry.observers.forEach((observer) => {
        observer(err);
      });
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  set(key: string, data: T) {
    const request = this.entries.get(key);
    if (!request) return;

    this._set(key, request, data);
  }

  private _set(key: string, entry: Entry<T>, data: T) {
    entry.data = data;
    entry.lastUpdated = Date.now();

    entry.observers.forEach((observer) => {
      observer(null, data);
    });

    if (this.options.cache) {
      this.options.cache.set(key, data);
    }
  }

  async invalidateBy(predicate: (key: string, data: T | null) => boolean) {
    await Promise.all(
      Array.from(this.entries.entries())
        .filter(([key, entry]) => predicate(key, entry.data))
        .map(([key, entry]) => this._invalidate(key, entry)),
    );
  }

  async invalidateMatching(regex: RegExp) {
    await this.invalidateBy((key) => regex.test(key));
  }

  ensureKey(key: string, request: Requester<T>) {
    const entry = this.entries.get(key);

    if (entry) {
      entry.request = request;
      return entry;
    }

    const newRequest = {
      request,
      data: null,
      observers: [],
      lastUpdated: 0,
    };

    this.entries.set(key, newRequest);
    return newRequest;
  }

  getCached(key: string, observer: RequestMapObserver<T>) {
    if (!this.options.cache) return;

    const data = this.options.cache.get(key);

    if (isPromise(data)) {
      data.then((data) => {
        if (data == null) return;

        // don't update if the real request beat us to it
        if (!this.entries.get(key)?.data) {
          observer(null, data, true);
        }
      });
    } else if (data != null) {
      observer(null, data, true);
    }
  }
}

function isPromise(obj: any): obj is Promise<unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'then' in obj &&
    typeof obj.then === 'function'
  );
}
