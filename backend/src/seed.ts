import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

async function main() {
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: "creator@example.com" },
    update: {},
    create: { email: "creator@example.com", passwordHash, role: "CREATOR" }
  });

  await prisma.user.upsert({
    where: { email: "consumer@example.com" },
    update: {},
    create: { email: "consumer@example.com", passwordHash, role: "CONSUMER" }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

