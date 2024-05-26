import { createNanoid } from "./utils/functions.ts";

let createIdInternal = createNanoid(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  10,
);

// used for testing
export function setCreateId(fn: () => string) {
  createIdInternal = fn;
}

export function createId(): string {
  return createIdInternal();
}
