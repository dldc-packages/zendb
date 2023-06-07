import { Column, Table } from '../../src/mod';

export const tasksDb = Table.declareMany({
  tasks: {
    id: Column.dt.text().primary(),
    title: Column.dt.text(),
    description: Column.dt.text(),
    completed: Column.dt.boolean(),
  },
  users: {
    id: Column.dt.text().primary(),
    name: Column.dt.text(),
    email: Column.dt.text(),
    displayName: Column.dt.text().nullable(),
  },
  users_tasks: {
    user_id: Column.dt.text().primary(),
    task_id: Column.dt.text().primary(),
  },
});
