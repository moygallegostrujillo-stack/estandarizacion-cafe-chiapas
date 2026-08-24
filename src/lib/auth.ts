// ============================================================
// src/lib/auth.ts — Configuración Auth.js v5 (unificado)
// ============================================================
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export type Role =
  | "SUPER_ADMIN"
  | "GERENTE"
  | "JEFE_AREA"
  | "SUPERVISOR"
  | "STAFF"
  | "RRHH"
  | "COMPRAS";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas (duración turno)
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.usuario.findUnique({
          where: { email },
        });

        if (!user || !user.activo) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        await prisma.usuario.update({
          where: { id: user.id },
          data: { ultimoAcceso: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          // Custom fields via cast
          ...({ rol: user.rol, sedeId: user.sedeIdActiva } as unknown as { rol: Role; sedeId: string | null }),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.rol = (user as unknown as { rol: Role }).rol;
        token.sedeId = (user as unknown as { sedeId: string | null }).sedeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id: string }).id = token.uid as string;
        (session.user as unknown as { rol: Role }).rol = token.rol as Role;
        (session.user as unknown as { sedeId: string | null }).sedeId = token.sedeId as string | null;
      }
      return session;
    },
  },
});

// Helper para obtener sesión actual en Server Components
export async function getSession() {
  return await auth();
}

// Helper para obtener usuario actual con su rol
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: (session.user as unknown as { id: string }).id as string,
    email: session.user.email!,
    nombre: session.user.name!,
    rol: (session.user as unknown as { rol: Role }).rol as Role,
    sedeId: (session.user as unknown as { sedeId: string | null }).sedeId as string | null,
  };
}

// Helper para requerir autenticación
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

// Helper para requerir un rol específico
export async function requireRole(roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.rol)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

// Extender tipos de sesión
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      rol: Role;
      sedeId: string | null;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    uid: string;
    rol: Role;
    sedeId: string | null;
  }
}
