// import type { FastifyInstance, FastifyRequest } from "fastify";
// import bcrypt from "bcryptjs";
// import { prisma } from "./prisma.js";
// import { LoginSchema } from "./schemas.js";

// export type AuthedUser = {
//   userId: string;
//   role: "CREATOR" | "CONSUMER";
//   email: string;
// };

// export async function registerAuthRoutes(app: FastifyInstance) {
//   app.post("/auth/login", async (req, reply) => {
//     const body = LoginSchema.parse(req.body);
//     const user = await prisma.user.findUnique({ where: { email: body.email } });
//     if (!user) return reply.code(401).send({ error: "Invalid credentials" });

//     const ok = await bcrypt.compare(body.password, user.passwordHash);
//     if (!ok) return reply.code(401).send({ error: "Invalid credentials" });

//     const token = await reply.jwtSign({
//       userId: user.id,
//       role: user.role,
//       email: user.email
//     });

//     return reply.send({
//       token,
//       user: { id: user.id, email: user.email, role: user.role }
//     });
//   });

//   app.get("/auth/me", { preValidation: [app.authenticate] }, async (req, reply) => {
//     const u = (req as any).user as AuthedUser;
//     return reply.send({ user: u });
//   });
// }

// export async function ensureRole(req: FastifyRequest, role: AuthedUser["role"]) {
//   const u = (req as any).user as AuthedUser | undefined;
//   if (!u) throw new Error("Unauthenticated");
//   if (u.role !== role) {
//     const err: any = new Error("Forbidden");
//     err.statusCode = 403;
//     throw err;
//   }
// }

import type { FastifyInstance, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";
import { LoginSchema } from "./schemas.js";

export type AuthedUser = {
  userId: string;
  role: "CREATOR" | "CONSUMER";
  email: string;
};

export async function registerAuthRoutes(app: FastifyInstance) {

  // ✅ LOGIN ROUTE (FIXED)
  app.post("/auth/login", async (req, reply) => {
    try {
      // 🔴 SAFE GUARD: req.body can be undefined in production
      if (!req.body) {
        return reply.code(400).send({ error: "Request body is missing" });
      }

      // ✅ Validate input safely
      const body = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email }
      });

      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(body.password, user.passwordHash);

      if (!ok) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const token = await reply.jwtSign({
        userId: user.id,
        role: user.role,
        email: user.email
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });

    } catch (err: any) {
      // 🔴 Prevent HTML/500 crashes leaking to frontend
      req.log.error(err);

      return reply.code(400).send({
        error: err?.message || "Login failed"
      });
    }
  });

  // ✅ ME ROUTE (UNCHANGED BUT SAFE)
  app.get(
    "/auth/me",
    { preValidation: [app.authenticate] },
    async (req, reply) => {
      const u = (req as any).user as AuthedUser;

      return reply.send({ user: u });
    }
  );
}

// ✅ ROLE CHECK (CLEANED)
export async function ensureRole(
  req: FastifyRequest,
  role: AuthedUser["role"]
) {
  const u = (req as any).user as AuthedUser | undefined;

  if (!u) {
    const err: any = new Error("Unauthenticated");
    err.statusCode = 401;
    throw err;
  }

  if (u.role !== role) {
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
}