export function wait(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function defer() {
  const deferred = {
    resolve: (_result: any) => {},
    reject: (_err: any) => {},
    promise: Promise.resolve<any>(null),
  };

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}
