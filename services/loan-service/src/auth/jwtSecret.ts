import crypto from 'crypto';

// Generated once per process. Any token signed before a restart is
// automatically invalid because the secret changes every time the service boots.
export const JWT_SECRET = crypto.randomBytes(32).toString('hex');
