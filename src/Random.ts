import { nanoid } from './utils/utils';

export const Random = (() => {
  let createId = () => nanoid(12);

  return {
    // used for testing
    setCreateId: (fn: () => string) => {
      createId = fn;
    },
    createId: () => createId(),
  };
})();
