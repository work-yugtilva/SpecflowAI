import assert from 'node:assert/strict';
import test from 'node:test';

import { SourceService } from './sourceService.js';

class QueryRecorder {
  filters: Array<[string, unknown]> = [];
  tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return Promise.resolve({
      data: [
        {
          id: 'evidence-1',
          source_file_id: 'source-1',
          user_id: '11111111-1111-1111-1111-111111111111',
          scope: 'session',
          scope_key: 'session:session-1',
          session_id: 'session-1',
          evidence_type: 'metric',
          title: 'Metric activation_rate',
          content: 'activation_rate averaged 0.38.',
          customer_label: null,
          theme: null,
          pain_point: null,
          product_area: null,
          sentiment: null,
          confidence: 1,
          row_reference: null,
          metadata: { metricName: 'activation_rate' },
          created_at: '2026-04-24T00:00:00.000Z',
          source_files: { filename: 'usage.csv' },
        },
      ],
      error: null,
    });
  }
}

test('listEvidenceForPipeline filters by authenticated user and scope key', async () => {
  const recorder = new QueryRecorder('source_evidence');
  const client = {
    from(tableName: string) {
      assert.equal(tableName, 'source_evidence');
      return recorder;
    },
  };
  const service = new SourceService(client as never);

  const result = await service.listEvidenceForPipeline(
    '11111111-1111-1111-1111-111111111111',
    { scope: 'session', sessionId: 'session-1' }
  );

  assert.deepEqual(recorder.filters, [
    ['user_id', '11111111-1111-1111-1111-111111111111'],
    ['scope_key', 'session:session-1'],
  ]);
  assert.equal(result[0].source_id, 'source-1');
  assert.equal(result[0].source_title, 'usage.csv');
  assert.equal(result[0].type, 'metric');
});
