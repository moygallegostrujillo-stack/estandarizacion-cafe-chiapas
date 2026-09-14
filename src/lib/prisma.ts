import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaAppUser: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function createAppUserClient() {
  // En local/Vercel-preview sin la variable, cae a DATABASE_URL para no romper build/dev.
  // En producción (con DATABASE_URL_APP_USER) usa el rol limitado app_user + RLS real.
  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL_APP_USER || process.env.DATABASE_URL!,
  });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

export const prismaAppUser =
  globalForPrisma.prismaAppUser ?? createAppUserClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaAppUser = prismaAppUser;
}
