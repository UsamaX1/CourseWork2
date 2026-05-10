import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("accepts valid env and coerces PORT", () => {
    const env = loadEnv({
      PORT: "3000",
      DATABASE_URL: "postgres://x",
      REDIS_URL: "redis://x",
      JWT_SECRET: "1234567890abcdef",
      S3_ENDPOINT: "http://localhost:9000",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "minio",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_BUCKET: "photos",
      PUBLIC_BASE_URL: "http://localhost:3000"
    } as any);
    expect(env.PORT).toBe(3000);
  });
});

