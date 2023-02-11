import { createNanoid } from './utils/utils';

export const Random = (() => {
  let createId = createNanoid('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

  return {
    // used for testing
    setCreateId: (fn: () => string) => {
      createId = fn;
    },
    createId: () => createId(),
  };
})();
