import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const cost = { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32, cost).toString('hex');
  return ['scrypt', cost.N, cost.r, cost.p, salt, hash].join('$');
}

export function verifyPassword(password, encoded) {
  if (
    typeof encoded !== 'string' ||
    !/^scrypt\$16384\$8\$5\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(encoded)
  ) {
    throw new Error('Password hash is not configured');
  }
  const [, , , , salt, expected] = encoded.split('$');
  const actual = scryptSync(password, salt, 32, cost);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
