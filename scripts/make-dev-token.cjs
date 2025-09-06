// scripts/make-dev-token.cjs
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'devsecret'; // must match data-service .env
const now = Math.floor(Date.now() / 1000);

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  id: 'dev-user',
  email: 'dev@local',
  role: 'admin',
  permissions: ['read:data_sources','write:data_sources','delete:data_sources'],
  aud: 'cwic-web',
  iss: 'cwic',
  iat: now,
  exp: now + 30 * 24 * 60 * 60, // 30 days
};

function b64url(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));
  return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function sign(input, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(input).digest());
}

const p1 = b64url(header);
const p2 = b64url(payload);
const sig = sign(`${p1}.${p2}`, SECRET);

console.log(`${p1}.${p2}.${sig}`);
