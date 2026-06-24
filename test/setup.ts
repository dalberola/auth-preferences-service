// Runs before any `src` module is imported, so env validation in config/env.ts passes.
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough-xx";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough-x";
process.env.ACCESS_TTL = "15m";
process.env.REFRESH_TTL_DAYS = "14";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.MAIL_FROM = "Test <no-reply@example.com>";
process.env.APP_URL = "http://localhost:4000";
process.env.CLIENT_URL = "http://localhost:3000";
