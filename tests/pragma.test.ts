import { expect, test } from 'vitest';
import { Database } from '../src/mod';
import { TestDatabase } from './utils/TestDatabase';

const db = TestDatabase.create();

test('read pragma', () => {
  const res = db.exec(Database.userVersion());
  expect(res).toEqual(0);
});

test('write pragma', () => {
  const res = db.exec(Database.setUserVersion(42));
  expect(res).toEqual(null);
  const version = db.exec(Database.userVersion());
  expect(version).toEqual(42);
});
