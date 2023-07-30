# @sjmeverett/request-map

Organizes requests by string keys so they can be deduped, cached and refetched.

## The problem

If you're not very careful, you can often end up making multiple requests to the server for the same data in one page load.

## Installation

```
npm install @sjmeverett/request-map
```

## Usage

The simplest way to use this library is with the `useRequest` hook:

```tsx
import { useRequest } from '@sjmeverett/request-map';

const { data, error, loading } = useRequest('key', async () => {
  const response = fetch('https://example.com');
  return response.json();
});
```

By default, all requests with the same key made within 1000ms will use the result from the same request.

You should try to make sure that the functions you pass for any given key get the same data — the underlying implementation will use whichever version of the function was specfied first in the current batch, but you shouldn't rely on that.

If the request with the given key has been made before, but it has been more than 1000ms (by default), the `data` value will be returned immediately with the stale value, but `loading` will still be set to `true` and the request will still be made. This allows you to show something to the user immediately, to give the impression of a faster connection. You could gray it out a bit or change the opacity slightly while `loading` is true, to show that it's stale and is refreshing.

Note the above caching only works for currently-observed requests. If no component is currently observing a given request key, the cached value will no longer be available. To cache for longer, including between app loads, see [Using a local cache](#using-a-local-cache).

## Using a specific map instance

The `useRequest` hook uses the `RequestMap` class underneath. By default, it uses a shared instance, so all uses of the hook will share the same request keys. If you want to isolate some of the requests, or you want to specify non-default options for the `RequestMap` class, you can use the `RequestMapProvider` component:

```tsx
import { RequestMap, RequestMapProvider } from '@sjmeverett/request-map';

const map = new RequestMap();

const App = () => {
  return <RequestMapProvider value={map}>{/* ... */}</RequestMapProvider>;
};
```

## Changing the caching time

As mentioned above, by default requests for a given key all use one request if made in the span of 1000ms. To change this value, you can specify the `ttl` (time to live) option:

```tsx
import { RequestMap, RequestMapProvider } from '@sjmeverett/request-map';

const map = new RequestMap({ ttl: 4000 });

const App = () => {
  return <RequestMapProvider value={map}>{/* ... */}</RequestMapProvider>;
};
```

## Using a local cache

You may also want to persist important data locally, for example the data visible when the app first loads, so that the user has something to look at while you fetch the most recent data.

You can specify a `cache` object to the constructor to enable this. It should have two methods: `get` and `set`. `get` can either return a value or a promise for the value, to support using IndexedDB for example. If the actual request resolves before the `get` promise resolves, the cached result is ignored.

Here is an example with a very simple cache:

```tsx
import { RequestMap, RequestMapProvider } from '@sjmeverett/request-map';

const cache: Record<string, any> = {};

const map = new RequestMap({
  cache: {
    get: (key) => cache[key],
    set: (key, value) => {
      cache[key] = value;
    },
  },
});

const App = () => {
  return <RequestMapProvider value={map}>{/* ... */}</RequestMapProvider>;
};
```

Note that just using a `Map` works as well, because it fits the interface:

```tsx
const map = new RequestMap({
  cache: new Map(),
});
```

Various other common cache packages will drop right in too, for example [lru-cache](https://www.npmjs.com/package/lru-cache).

Warning: if you've got an app with a lot of data, your memory usage could get quickly out of hand unless you're careful with caching.

## Getting the map instance

You can grab the map instance from context by using the `useRequestMap` hook:

```tsx
import { useRequestMap } from '@sjmeverett/request-map';

const MyComponent = () => {
  const map = useRequestMap();
};
```

## Refetching data

You can cause the map to refetch a key by using the `invalidate` method. For example, if you create a new todo item, you might want to invalidate the query that lists them, so that it will fetch the whole list again including the new one:

```tsx
const map = useRequestMap();
map.invalidate('listTodos');
```

The `invalidate` method returns a promise that you can await to know when it's done if you like.

If you have more complex keys, you might want to use `invalidateBy` or `invalidateMatching`. For example, if you have different list views with different parameters, these might have slightly different keys: let's say `listTodos?showCompleted` and `listTodos`.

You could use `invalidateMatching` to invalidate both like so:

```tsx
map.invalidateMatching(/^listTodos/);
```

Or, you could use `invalidateBy` and a predicate, like so:

```tsx
map.invalidateBy((key) => key.startsWith('listTodos'));
```

Whichever way you invalidate the keys, the map will call the most recently-specified fetch method for each key, and then update all observers with the results.

## The `request` method

You can use the `request` method directly, without using the `useRequest` hook. It takes 3 arguments:

- `key` — identifies the request
- `observer` — a callback function which is called when the request has new data or encounters an error
- `request` — a function which actually fetches the data, returning a promise

```tsx
const map = new RequestMap();
const [data, setData] = useState<T>();
const [error, setError] = useState<unknown>();
const [loading, setLoading] = useState(true);

const unsubscribe = map.request(
  'listTodos',
  (err, data, stale) => {
    if (err) {
      setError(err);
    } else {
      setData(data);
    }
    if (!stale) {
      setLoading(false);
    }
  },
  () => {
    const response = fetch('https://example.com');
    return response.json();
  },
);
```

It returns an unsubscribe function which you should call when the component unmounts or when you no longer need the request key. When all the susbcribers for a given key have unsubscribed, the map will forget about it.

## Updating a request result manually

You may want to notify all the observers for a given request key of a new value, without actually doing the request. For example, you might be notified of a new value via a websocket. You can use the `set` method for this:

```tsx
const map = useRequestMap();
map.set('myQuery', newValue);
```

## Contributing

If you notice a bug, please file an issue!
