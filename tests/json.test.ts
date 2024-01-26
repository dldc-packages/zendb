import { beforeAll, beforeEach, expect, test } from 'vitest';
import { Expr, Random, Table } from '../src/mod';
import { format, sql } from './utils/sql';
import { tasksDb } from './utils/tasksDb';

let nextRandomId = 0;

beforeAll(() => {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
});

beforeEach(() => {
  nextRandomId = 0;
});

test('Basic json function', () => {
  const res = tasksDb.tasks
    .query()
    .select((c) => ({
      id: c.id,
      data: Expr.jsonObj(c),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    SELECT
      tasks.id AS id,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS data
    FROM
      tasks
  `);
});

test('Nested json object', () => {
  const res = tasksDb.tasks
    .query()
    .select(({ id, title, description }) => ({
      id,
      data: Expr.jsonObj({ title, description, inner: Expr.jsonObj({ title, description }) }),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    SELECT
      tasks.id AS id,
      json_object (
        'title', tasks.title,
        'description', tasks.description,
        'inner', json_object (
          'title', tasks.title,
          'description', tasks.description
        )
      ) AS data
    FROM tasks
  `);
});

test('Json in json', () => {
  const base = tasksDb.tasks.query().select((c) => ({
    id: c.id,
    data: Expr.jsonObj(c),
  }));

  const res = Table.from(base)
    .select((c) => ({
      id: c.id,
      data: Expr.jsonObj({ data: c.data }),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    WITH
      cte_id0 AS (
        SELECT
          tasks.id AS id,
          json_object(
            'id', tasks.id,
            'title', tasks.title,
            'description', tasks.description,
            'completed', tasks.completed
          ) AS data
        FROM
          tasks
      )
    SELECT
      cte_id0.id AS id,
      json_object('data', json(cte_id0.data)) AS data
    FROM
      cte_id0
  `);
});
