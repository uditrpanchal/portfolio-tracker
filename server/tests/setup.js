import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// These must be set before any route/service module is imported by the test file.
// setupFiles run in each worker before the test file is evaluated, so this is safe.
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  for (const coll of Object.values(mongoose.connection.collections)) {
    await coll.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
