import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

test('Security: Password hashing and comparison', async () => {
  const password = 'TestSecurePassword@123';
  const hash = await bcrypt.hash(password, 10);

  assert.notEqual(password, hash);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare('WrongPassword', hash), false);
});

test('Security: JWT token signing and verification', () => {
  const secret = 'super_secret_test_key_32_characters_long';
  const payload = { userId: '11111111-2222-3333-4444-555555555555' };

  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  const decoded = jwt.verify(token, secret) as { userId: string };

  assert.equal(decoded.userId, payload.userId);
});

test('RBAC: Permission verification logic', () => {
  const userPermissions = ['candidates.read', 'candidates.create', 'interviews.schedule'];

  const canRead = userPermissions.includes('candidates.read');
  const canDelete = userPermissions.includes('candidates.delete');

  assert.equal(canRead, true);
  assert.equal(canDelete, false);
});
