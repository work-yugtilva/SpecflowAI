import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';
import request from 'supertest';

import type { AuthRequest } from '@/middleware/verify_supabase_token.js';
import sourceRoutes from './sources.js';

class FakeQuery {
  private filters = new Map<string, unknown>();
  private payload: unknown;

  constructor(
    private readonly db: FakeSupabaseClient,
    private readonly tableName: string,
    private readonly operation: 'insert' | 'update' | 'select' | 'delete' = 'select'
  ) {}

  insert(payload: unknown) {
    this.payload = payload;
    return new FakeQuery(this.db, this.tableName, 'insert').setPayload(payload);
  }

  update(payload: unknown) {
    this.payload = payload;
    return new FakeQuery(this.db, this.tableName, 'update').setPayload(payload);
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  single() {
    if (this.tableName === 'source_files' && this.operation === 'insert') {
      const row = {
        id: 'source-1',
        ...(this.payload as Record<string, unknown>),
        parsed_text: null,
        summary: null,
        error_message: null,
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      };
      this.db.sourceFiles.push(row);
      return Promise.resolve({ data: row, error: null });
    }

    if (this.tableName === 'source_files' && this.operation === 'update') {
      const id = this.filters.get('id');
      const row = this.db.sourceFiles.find((item) => item.id === id);
      Object.assign(row as Record<string, unknown>, this.payload);
      return Promise.resolve({ data: row, error: null });
    }

    return Promise.resolve({ data: null, error: null });
  }

  setPayload(payload: unknown) {
    this.payload = payload;
    return this;
  }

  then(resolve: (value: { data: unknown; error: null }) => void) {
    if (this.tableName === 'source_evidence' && this.operation === 'insert') {
      const rows = (this.payload as Array<Record<string, unknown>>).map((row, index) => ({
        id: `evidence-${index + 1}`,
        ...row,
        created_at: '2026-04-24T00:00:00.000Z',
      }));
      this.db.sourceEvidence.push(...rows);
      resolve({ data: rows, error: null });
      return;
    }
    resolve({ data: [], error: null });
  }
}

class FakeSupabaseClient {
  sourceFiles: Array<Record<string, unknown>> = [];
  sourceEvidence: Array<Record<string, unknown>> = [];

  from(tableName: string) {
    return new FakeQuery(this, tableName);
  }
}

test('POST /api/sources/upload creates a source file and extracted evidence', async () => {
  const fakeClient = new FakeSupabaseClient();
  const app = express();
  app.use((req, _res, next) => {
    const authReq = req as AuthRequest;
    authReq.user = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      role: 'authenticated',
    };
    authReq.userClient = fakeClient as never;
    next();
  });
  app.use('/api/sources', sourceRoutes);

  const response = await request(app)
    .post('/api/sources/upload?scope=session&sessionId=22222222-2222-2222-2222-222222222222')
    .attach(
      'files',
      Buffer.from('This paragraph is confusing and cannot be completed without manual support help.'),
      {
        filename: 'interview.txt',
        contentType: 'text/plain',
      }
    );

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data[0].source.status, 'processed');
  assert.equal(response.body.data[0].evidenceCount, 2);
  assert.equal(fakeClient.sourceFiles[0].user_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(fakeClient.sourceFiles[0].scope_key, 'session:22222222-2222-2222-2222-222222222222');
  assert.equal(fakeClient.sourceEvidence.length, 2);
});
