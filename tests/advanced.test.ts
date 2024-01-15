import { beforeAll, beforeEach, expect, test } from 'vitest';
import type { ITable } from '../src/mod';
import { Database, Expr, Random } from '../src/mod';
import { TestDatabase } from './utils/TestDatabase';
import { format, sql } from './utils/sql';
import { tasksDb } from './utils/tasksDb';

let nextRandomId = 0;

const db = TestDatabase.create();

beforeAll(() => {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
});

beforeEach(() => {
  nextRandomId = 0;
});

type UserInput = (typeof tasksDb)['users'] extends ITable<infer Val, any> ? Val : never;
type TaksInput = (typeof tasksDb)['tasks'] extends ITable<infer Val, any> ? Val : never;

test('Select ', () => {
  db.execMany(Database.schema(tasksDb));

  const users: UserInput[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@exmaple.com',
      displayName: null,
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      displayName: 'Jane',
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
    {
      id: '3',
      name: 'Jack Doe',
      email: 'jack@example.com',
      displayName: 'Jack',
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
  ];

  users.forEach((user) => db.exec(tasksDb.users.insert(user)));

  const tasks: TaksInput[] = [
    { id: '1', title: 'First Task', description: 'First Task', completed: false },
    { id: '2', title: 'Second Task', description: 'Second Task', completed: true },
    { id: '3', title: 'Third Task', description: 'Third Task', completed: true },
    { id: '4', title: 'Fourth Task', description: 'Fourth Task', completed: false },
    { id: '5', title: 'Fifth Task', description: 'Fifth Task', completed: false },
  ];

  tasks.forEach((task) => db.exec(tasksDb.tasks.insert(task)));

  db.exec(tasksDb.users_tasks.insert({ user_id: '1', task_id: '1' }));
  db.exec(tasksDb.users_tasks.insert({ user_id: '1', task_id: '2' }));
  db.exec(tasksDb.users_tasks.insert({ user_id: '2', task_id: '3' }));

  const allUsers = tasksDb.users.query();
  const tasksByUserId = tasksDb.users_tasks
    .query()
    .innerJoin(tasksDb.tasks.query(), 'task', (c) => Expr.equal(c.task_id, c.task.id))
    .groupBy((c) => [c.user_id])
    .select((c) => ({ userId: c.user_id, tasks: Expr.jsonAgg(Expr.jsonObj(c.task)) }));

  const tasksByUserIdOp = tasksByUserId.all();

  expect(format(tasksByUserIdOp.sql)).toEqual(sql`
    SELECT
      users_tasks.user_id AS userId,
      json_group_array(
        json_object(
          'id',
          tasks.id,
          'title',
          tasks.title,
          'description',
          tasks.description,
          'completed',
          tasks.completed
        )
      ) AS tasks
    FROM
      users_tasks
      INNER JOIN tasks ON users_tasks.task_id == tasks.id
    GROUP BY
      users_tasks.user_id
  `);

  const tasksByUserIdResult = db.exec(tasksByUserIdOp);

  expect(tasksByUserIdResult).toEqual([
    {
      tasks: [
        { completed: false, description: 'First Task', id: '1', title: 'First Task' },
        { completed: true, description: 'Second Task', id: '2', title: 'Second Task' },
      ],
      userId: '1',
    },
    { tasks: [{ completed: true, description: 'Third Task', id: '3', title: 'Third Task' }], userId: '2' },
  ]);

  const query = allUsers
    .leftJoin(tasksByUserId, 'tasks', (c) => Expr.equal(c.id, c.tasks.userId))
    .select(({ tasks, ...rest }) => ({ ...rest, tasks: tasks.tasks }))
    .all();

  expect(format(query.sql)).toEqual(sql`
    WITH
      cte_id46 AS (
        SELECT
          users_tasks.user_id AS userId,
          json_group_array(
            json_object(
              'id',
              tasks.id,
              'title',
              tasks.title,
              'description',
              tasks.description,
              'completed',
              tasks.completed
            )
          ) AS tasks
        FROM
          users_tasks
          INNER JOIN tasks ON users_tasks.task_id == tasks.id
        GROUP BY
          users_tasks.user_id
      )
    SELECT
      users.id AS id,
      users.name AS name,
      users.email AS email,
      users.displayName AS displayName,
      users.updatedAt AS updatedAt,
      cte_id46.tasks AS tasks
    FROM
      users
      LEFT JOIN cte_id46 ON users.id == cte_id46.userId
  `);

  const result = db.exec(query);

  expect(result).toEqual([
    {
      displayName: null,
      email: 'john@exmaple.com',
      id: '1',
      name: 'John Doe',
      tasks: [
        { completed: false, description: 'First Task', id: '1', title: 'First Task' },
        { completed: true, description: 'Second Task', id: '2', title: 'Second Task' },
      ],
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
    {
      displayName: 'Jane',
      email: 'jane@example.com',
      id: '2',
      name: 'Jane Doe',
      tasks: [{ completed: true, description: 'Third Task', id: '3', title: 'Third Task' }],
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
    {
      displayName: 'Jack',
      email: 'jack@example.com',
      id: '3',
      name: 'Jack Doe',
      tasks: null,
      updatedAt: new Date('2023-12-24T22:30:12.250Z'),
    },
  ]);
});
