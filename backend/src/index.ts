import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { loadEnv } from "./env.js";
import { registerAuthRoutes } from "./auth.js";
import { registerPhotoRoutes } from "./routes/photos.js";
import { createRedis } from "./redis.js";
import { createS3, ensureBucket } from "./s3.js";

const env = loadEnv(process.env);

const app = Fastify({
  logger: true
});

// await app.register(cors, { origin: true });
await app.register(cors, {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://photoshare-frontend-new-cwcdadh2hce6eydw.francecentral-01.azurewebsites.net"
  ],
  credentials: true
});
await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

await app.register(jwt, { secret: env.JWT_SECRET });

app.decorate("authenticate", async function (req: any, reply: any) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});

await app.register(swagger, {
  openapi: {
    info: {
      title: "PhotoShare API",
      version: "1.0.0"
    }
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

const redis = createRedis(env.REDIS_URL);
const s3 = createS3({
  endpoint: env.S3_ENDPOINT,
  publicEndpoint: env.S3_PUBLIC_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET,
  publicBaseUrl: env.PUBLIC_BASE_URL
});
await ensureBucket(s3);

app.decorate("redis", redis);
app.decorate("s3", s3);

app.get("/health", async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerPhotoRoutes(app);

await app.ready();
app.swagger();

await app.listen({ port: env.PORT, host: "0.0.0.0" });

