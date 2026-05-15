import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';
import request from 'supertest';

import type { AuthRequest } from '@/middleware/verify_supabase_token.js';
import researchRoutes from './research.js';

class FakeQuery {
  filters: Array<[string, unknown]> = [];
  nullFilters: string[] = [];

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
    return Promise.resolve({
      data: [],
      error: null,
      count: 0,
    });
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.tableName === 'sessions' ? { id: 'session-1' } : null,
      error: null,
    });
  }
}

class FakeSupabaseClient {
  queries: Record<string, FakeQuery[]> = {};

  from(tableName: string) {
    const query = new FakeQuery(tableName);
    this.queries[tableName] = [...(this.queries[tableName] ?? []), query];
    return query;
  }
}

function buildApp(fakeClient: FakeSupabaseClient) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const authReq = req as AuthRequest;
    authReq.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'authenticated',
    };
    authReq.userClient = fakeClient as never;
    next();
  });
  app.use('/api/research', researchRoutes);
  return app;
}

test('GET /api/research?sessionId scopes to the authenticated session', async () => {
  const fakeClient = new FakeSupabaseClient();
  const app = buildApp(fakeClient);

  const response = await request(app).get('/api/research?sessionId=session-1');

  assert.equal(response.status, 200);
  assert.deepEqual(fakeClient.queries.sessions[0].filters, [
    ['id', 'session-1'],
    ['user_id', 'user-1'],
  ]);
  assert.deepEqual(fakeClient.queries.research_entries[0].filters, [
    ['user_id', 'user-1'],
    ['scope_key', 'session:session-1'],
  ]);
  assert.deepEqual(fakeClient.queries.research_entries[0].nullFilters, ['deleted_at']);
});
