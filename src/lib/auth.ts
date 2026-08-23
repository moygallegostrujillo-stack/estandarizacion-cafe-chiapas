import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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

        // Buscar usuario por email
        const user = await prisma.usuario.findUnique({
          where: { email },
          include: {
            membresias: {
              include: { equipo: true },
              where: { activo: true },
            },
          },
        });

        if (!user || !user.activo) return null;

        // Verificar contraseña
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Obtener el primer rol y sede activos
        const membresia = user.membresias[0];
        
        return {
          id: user.id,
          email: user.email,
          name: `${user.nombre} ${user.apellido || ""}`.trim(),
          image: user.avatarUrl,
          rol: membresia?.rol || "STAFF",
          sedeId: user.sedeIdActiva || membresia?.equipo.sedeId || "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as any).rol;
        token.sedeId = (user as any).sedeId;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).rol = token.rol;
        (session.user as any).sedeId = token.sedeId;
        (session.user as any).userId = token.userId;
      }
      return session;
    },
  },
});
