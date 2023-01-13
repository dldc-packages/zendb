import { tasksSchema } from './utils/tasksSchema';
import { TestDatabase } from './utils/TestDatabase';

const db = TestDatabase.create(tasksSchema);

const t = db.tables;

test('create database', () => {
  const res = db.execMany(db.init());
  expect(res).toEqual([null, null, null]);
  const tables = db.exec(TestDatabase.listTables());
  expect(tables).toEqual(['tasks', 'users', 'users_tasks']);
});

test('insert tasks', () => {
  const res = db.exec(t.tasks.insert({ id: '1', title: 'Task 1', completed: false, description: 'First task' }));
  expect(res).toEqual({ id: '1', title: 'Task 1', completed: false, description: 'First task' });
});

test('find tasks', () => {
  const res = db.exec(t.tasks.select().fields({ id: true, title: true }).all());
  expect(res).toEqual([{ id: '1', title: 'Task 1' }]);
});

test('create user', () => {
  const res = db.exec(t.users.insert({ id: '1', name: 'John', email: 'john@example.com' }));
  expect(res).toEqual({ id: '1', name: 'John', email: 'john@example.com' });
});

test('link task and user', () => {
  const res = db.exec(t.users_tasks.insert({ user_id: '1', task_id: '1' }));
  expect(res).toEqual({ user_id: '1', task_id: '1' });
});

test('find tasks for user email', () => {
  const res = db.exec(
    t.users
      .select()
      .filter({ email: 'john@example.com' })
      .joinOne('id', 'users_tasks', 'user_id')
      .joinOne('task_id', 'tasks', 'id')
      .fields({ id: true, title: true, completed: true })
      .all()
  );
  expect(res).toEqual([{ completed: false, id: '1', title: 'Task 1' }]);
});
