import type Redis from "ioredis";
import type { createS3 } from "./s3.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
    redis: Redis;
    s3: ReturnType<typeof createS3>;
  }
}

