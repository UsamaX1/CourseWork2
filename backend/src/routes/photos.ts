import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../prisma.js";
import { ensureRole, type AuthedUser } from "../auth.js";
import { presignGetUrl, putObject } from "../s3.js";
import { PhotoMetaSchema } from "../schemas.js";

const ListQuery = z.object({
  q: z.string().optional(),
  location: z.string().optional(),
  person: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional()
});

export async function registerPhotoRoutes(app: FastifyInstance) {
  async function bumpListCacheVersion() {
    await app.redis.incr("photos:list:version");
  }

  // Creator: list own uploads (useful for demo/creator view)
  app.get(
    "/creator/photos",
    { preValidation: [app.authenticate] },
    async (req, reply) => {
      await ensureRole(req, "CREATOR");
      const user = (req as any).user as AuthedUser;
      const photos = await prisma.photo.findMany({
        where: { creatorId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { comments: true, ratings: true } } }
      });
      return reply.send({ photos });
    }
  );

  // Creator: upload with metadata + file
  app.post(
    "/photos",
    {
      preValidation: [app.authenticate]
    },
    async (req, reply) => {
      await ensureRole(req, "CREATOR");
      const user = (req as any).user as AuthedUser;

      const mp = await (req as any).file();
      if (!mp) return reply.code(400).send({ error: "Missing file" });

      const metaRaw = (mp.fields?.meta?.value ?? mp.fields?.meta) as string | undefined;
      if (!metaRaw) return reply.code(400).send({ error: "Missing meta field" });

      let metaJson: unknown;
      try {
        metaJson = JSON.parse(metaRaw);
      } catch {
        return reply.code(400).send({ error: "Invalid meta JSON" });
      }
      const meta = PhotoMetaSchema.parse(metaJson);

      const buf = await mp.toBuffer();
      const mimeType = mp.mimetype ?? "application/octet-stream";
      if (!mimeType.startsWith("image/")) return reply.code(400).send({ error: "Only images are supported" });

      const ext = mimeType.split("/")[1] ?? "bin";
      const key = `photos/${crypto.randomUUID()}.${ext}`;
      await putObject(app.s3, { key, body: buf, contentType: mimeType });

      // Advanced feature: thumbnail generation for faster consumer browsing.
      const thumb = await sharp(buf).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      const thumbKey = `thumbs/${crypto.randomUUID()}.jpg`;
      await putObject(app.s3, { key: thumbKey, body: thumb, contentType: "image/jpeg" });

      const photo = await prisma.photo.create({
        data: {
          title: meta.title,
          caption: meta.caption,
          location: meta.location,
          people: meta.people,
          objectKey: key,
          thumbKey,
          mimeType,
          byteSize: buf.byteLength,
          creatorId: user.userId
        }
      });

      await bumpListCacheVersion();
      return reply.code(201).send({ photo });
    }
  );

  // Consumer: list/search photos (cached)
  app.get("/photos", async (req, reply) => {
    const q = ListQuery.parse((req as any).query);
    const v = (await app.redis.get("photos:list:version")) ?? "0";
    const cacheKey = `photos:list:v${v}:${JSON.stringify(q)}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const where: any = {};
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: "insensitive" } },
        { caption: { contains: q.q, mode: "insensitive" } }
      ];
    }
    if (q.location) where.location = { contains: q.location, mode: "insensitive" };
    if (q.person) where.people = { has: q.person };

    const photos = await prisma.photo.findMany({
      where,
      take: q.limit,
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, email: true } },
        _count: { select: { comments: true, ratings: true } }
      }
    });

    const payload = { photos };
    await app.redis.set(cacheKey, JSON.stringify(payload), "EX", 30);
    return reply.send(payload);
  });

  // Consumer: retrieve signed media URLs
  app.get("/photos/:id/media", async (req, reply) => {
    const id = z.object({ id: z.string() }).parse((req as any).params).id;
    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { objectKey: true, thumbKey: true, mimeType: true }
    });
    if (!photo) return reply.code(404).send({ error: "Not found" });

    const fullUrl = await presignGetUrl(app.s3, { key: photo.objectKey, expiresInSeconds: 60 });
    const thumbUrl = photo.thumbKey
      ? await presignGetUrl(app.s3, { key: photo.thumbKey, expiresInSeconds: 60 })
      : null;

    return reply.send({ fullUrl, thumbUrl, mimeType: photo.mimeType });
  });

  // Consumer: proxy media through API (avoids S3 signature/CORS issues in browsers)
  app.get("/photos/:id/blob", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse((req as any).params);
    const kind = z
      .object({ kind: z.enum(["full", "thumb"]).default("full") })
      .parse((req as any).query).kind;

    const photo = await prisma.photo.findUnique({
      where: { id },
      select: { objectKey: true, thumbKey: true, mimeType: true }
    });
    if (!photo) return reply.code(404).send({ error: "Not found" });

    const key = kind === "thumb" ? photo.thumbKey : photo.objectKey;
    if (!key) return reply.code(404).send({ error: "Not found" });

    const obj = await app.s3.internalClient.send(
      new GetObjectCommand({
        Bucket: app.s3.cfg.bucket,
        Key: key
      })
    );

    const ct = (obj.ContentType as string | undefined) ?? (kind === "thumb" ? "image/jpeg" : photo.mimeType);
    reply.header("Content-Type", ct);
    reply.header("Cache-Control", "public, max-age=60");

    // @aws-sdk/client-s3 returns a Readable stream in Node.js
    return reply.send(obj.Body as any);
  });

  // Consumer: photo details (cached)
  app.get("/photos/:id", async (req, reply) => {
    const id = z.object({ id: z.string() }).parse((req as any).params).id;
    const cacheKey = `photos:detail:${id}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, email: true } },
        comments: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { id: true, email: true } } } },
        ratings: { select: { value: true, userId: true } }
      }
    });
    if (!photo) return reply.code(404).send({ error: "Not found" });

    const avg =
      photo.ratings.length === 0
        ? null
        : photo.ratings.reduce((s: number, r: { value: number }) => s + r.value, 0) / photo.ratings.length;

    const payload = { photo: { ...photo, ratingAvg: avg } };
    await app.redis.set(cacheKey, JSON.stringify(payload), "EX", 30);
    return reply.send(payload);
  });

  // Consumer: comment
  app.post(
    "/photos/:id/comments",
    { preValidation: [app.authenticate] },
    async (req, reply) => {
      const user = (req as any).user as AuthedUser;
      await ensureRole(req, "CONSUMER");
      const { id } = z.object({ id: z.string() }).parse((req as any).params);
      const { text } = z.object({ text: z.string().min(1).max(2000) }).parse((req as any).body);

      const exists = await prisma.photo.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "Not found" });

      const comment = await prisma.comment.create({
        data: { text, photoId: id, userId: user.userId },
        include: { user: { select: { id: true, email: true } } }
      });

      await app.redis.del(`photos:detail:${id}`);
      await bumpListCacheVersion();
      return reply.code(201).send({ comment });
    }
  );

  // Consumer: rate (1-5)
  app.post(
    "/photos/:id/ratings",
    { preValidation: [app.authenticate] },
    async (req, reply) => {
      const user = (req as any).user as AuthedUser;
      await ensureRole(req, "CONSUMER");
      const { id } = z.object({ id: z.string() }).parse((req as any).params);
      const { value } = z.object({ value: z.coerce.number().int().min(1).max(5) }).parse((req as any).body);

      const exists = await prisma.photo.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "Not found" });

      const rating = await prisma.rating.upsert({
        where: { photoId_userId: { photoId: id, userId: user.userId } },
        create: { value, photoId: id, userId: user.userId },
        update: { value }
      });

      await app.redis.del(`photos:detail:${id}`);
      await bumpListCacheVersion();
      return reply.code(201).send({ rating });
    }
  );
}

