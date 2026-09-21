import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPersistedToken,
  getPersistedToken,
  setPersistedToken,
  saveDraft,
  loadDraft,
} from '../public/storage.js';

const token = 'persisted-token';

test('auth token persists across restarts', () => {
  clearPersistedToken();
  assert.equal(getPersistedToken(), null);

  setPersistedToken(token);
  assert.equal(getPersistedToken(), token);

  clearPersistedToken();
  assert.equal(getPersistedToken(), null);
});

test('draft messages persist in storage', () => {
  saveDraft('message', 'hello there');
  assert.equal(loadDraft('message'), 'hello there');

  clearPersistedToken();
});
