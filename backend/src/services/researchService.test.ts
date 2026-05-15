import assert from 'node:assert/strict';
import test from 'node:test';

import { ResearchService } from './researchService.js';

class QueryRecorder {
  filters: Array<[string, unknown]> = [];
  nullFilters: string[] = [];
  updates: Record<string, unknown> | null = null;
  deleted = false;

  constructor(private readonly tableName: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  is(column: string, value: unknown) {
    if (value === null) this.nullFilters.push(column);
    return this;
  }

  order() {
    return this;
  }

  range() {
    return Promise.resolve({ data: [], error: null, count: 0 });
  }

  update(payload: Record<string, unknown>) {
    this.updates = payload;
    return this;
  }

  delete() {
    this.deleted = true;
    return this;
  }

  single() {
    return Promise.resolve({
      data: {
        id: 'research-1',
        user_id: 'user-1',
        scope: 'session',
        scope_key: 'session:session-1',
        session_id: 'session-1',
        type: 'Interview',
        title: 'Interview',
        content: 'Discovery notes',
        user_label: '',
        pain_point: '',
        context_text: '',
        tags: [],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
        deleted_at: '2026-04-25T00:00:00.000Z',
        metric_name: null,
        metric_value: null,
        metric_baseline: null,
        metric_unit: null,
        time_period: null,
        data_source: null,
      },
      error: null,
    });
  }

  maybeSingle() {
    return Promise.resolve({
      data:
        this.tableName === 'sessions'
          ? { id: 'session-1' }
          : this.tableName === 'research_entries'
          ? {
              id: 'research-1',
              scope: 'session',
              session_id: 'session-1',
            }
          : null,
      error: null,
    });
  }
}

test('getEntries excludes soft-deleted research rows', async () => {
  const recorders: Record<string, QueryRecorder> = {};
  const client = {
    from(tableName: string) {
      assert.ok(['research_entries', 'sessions'].includes(tableName));
      recorders[tableName] = new QueryRecorder(tableName);
      return recorders[tableName];
    },
  };
  const service = new ResearchService();

  await service.getEntries('user-1', { scope: 'session', sessionId: 'session-1' }, client as never);

  assert.deepEqual(recorders.sessions.filters, [
    ['id', 'session-1'],
    ['user_id', 'user-1'],
  ]);
  assert.deepEqual(recorders.research_entries.filters, [
    ['user_id', 'user-1'],
    ['scope_key', 'session:session-1'],
  ]);
  assert.deepEqual(recorders.research_entries.nullFilters, ['deleted_at']);
});

test('deleteEntry soft deletes research rows instead of removing them', async () => {
  const recorders: Record<string, QueryRecorder[]> = {};
  const client = {
    from(tableName: string) {
      assert.ok(['research_entries', 'sessions'].includes(tableName));
      const recorder = new QueryRecorder(tableName);
      recorders[tableName] = [...(recorders[tableName] ?? []), recorder];
      return recorder;
    },
  };
  const service = new ResearchService();

  await service.deleteEntry('user-1', 'research-1', client as never);

  const lookup = recorders.research_entries[0];
  const update = recorders.research_entries[1];
  assert.deepEqual(lookup.filters, [
    ['user_id', 'user-1'],
    ['id', 'research-1'],
  ]);
  assert.deepEqual(recorders.sessions[0].filters, [
    ['id', 'session-1'],
    ['user_id', 'user-1'],
  ]);
  assert.equal(update.deleted, false);
  assert.equal(typeof update.updates?.deleted_at, 'string');
  assert.deepEqual(update.filters, [
    ['user_id', 'user-1'],
    ['id', 'research-1'],
  ]);
});
