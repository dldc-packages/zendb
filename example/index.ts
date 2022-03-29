import * as zen from '../src';
import { schema as v001 } from './migrations/001';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { nanoid } from 'nanoid';

export * from './migrations/001';

const DATA_PATH = resolve('example/data');

try {
  mkdirSync(DATA_PATH);
} catch {
  //
}

const migrations = zen.Migrations.create({
  id: 'init',
  description: 'Initialize the database',
  schema: v001,
});

export type Db = typeof db;

const db = migrations.applySync({
  databasePath: resolve(DATA_PATH, 'database.db'),
  migrationDatabasePath: resolve(DATA_PATH, 'migration-database.db'),
});

const userByMail = db.tables.users
  .query()
  .where({ email: 'e.dldc@gmail.com' })
  .select({ email: true, name: true })
  .all();

const firstTask = db.tables.tasks.query().maybeFirst();

const newTask = db.tables.tasks.insert({
  id: nanoid(10),
  chainId: '',
  color: '',
  date: new Date(),
  name: '',
  infos: '',
  priority: 'low',
  repeat: null,
  spaceId: '',
  big: 12n,
});

db.tables.spaces.delete({ id: '' }, { limit: 1 });
db.tables.spaces.deleteOne({ id: '' });

const tasksWithUsers = db.tables.tasks
  .query()
  .limit(10)
  .select({ id: true, name: true, date: true })
  .join('id', 'task_user', 'taskId')
  .joinOne('userEmail', 'users', 'email')
  .select({ email: true, name: true })
  .all();

// tasksWithUsers[0].task_user[0].email;

db.tables.tasks.delete({ id: 'yolo' });
