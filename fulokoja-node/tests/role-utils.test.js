import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveUserRole } from '../src/role-utils.js';

test('resolveUserRole prefers app metadata for admin access', () => {
  const role = resolveUserRole({
    app_metadata: { role: 'administrator' },
    user_metadata: { role: 'lecturer' },
  });

  assert.equal(role, 'administrator');
});

test('resolveUserRole falls back to profile role when auth metadata is absent', () => {
  const role = resolveUserRole({ email: 'staff@fulokoja.edu.ng' }, 'lecturer');

  assert.equal(role, 'lecturer');
});
