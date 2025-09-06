// jwtgen.js
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  {
    id: 'dev-user',
    email: 'dev@local',
    role: 'admin',
    permissions: ['*'],
    aud: 'cwic-web',
    iss: 'cwic',
  },
  'devsecret',          // MUST match backend/data-service/.env JWT_SECRET
  { expiresIn: '30d' }
);
console.log(token);
