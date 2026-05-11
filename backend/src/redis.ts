// import Redis from "ioredis";

// export function createRedis(url: string) {
//   return new Redis(url, {
//     lazyConnect: false,
//     maxRetriesPerRequest: 2,
//     enableReadyCheck: true
//   });
// }

import Redis from "ioredis";

export function createRedis() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  return new Redis(url, {
    maxRetriesPerRequest: null,
    tls: {
      rejectUnauthorized: false
    }
  });
}