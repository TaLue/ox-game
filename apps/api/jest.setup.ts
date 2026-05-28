// Load root .env for all tests so ConfigModule env validation passes
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Hard-code test fallbacks in case .env is absent (CI without secrets)
process.env.DATABASE_URL ??= 'postgresql://ox:ox@localhost:5432/ox';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SESSION_SECRET ??= 'test-secret';
process.env.NODE_ENV ??= 'test';
