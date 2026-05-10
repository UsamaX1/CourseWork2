import { z } from "zod";

export const PhotoMetaSchema = z.object({
  title: z.string().min(1).max(120),
  caption: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  people: z.array(z.string().min(1).max(50)).max(20).default([])
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

