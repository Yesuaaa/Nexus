import { Role, type User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

export interface CreateUserData {
  email: string
  fullName: string
  contactNumber: string
  passwordHash: string
  role?: Role
}

export interface CreateSessionData {
  tokenHash: string
  userId: string
  expiresAt: Date
}

export const authRepository = {
  isDatabaseAvailable(): boolean {
    return Boolean(getPrisma())
  },

  async findUserByEmail(email: string) {
    const prisma = getPrisma()
    if (!prisma) return null
    return prisma.user.findUnique({
      where: { email },
      include: {
        headOf: { select: { id: true } },
        department: {
          select: { id: true, name: true, code: true, color: true },
        },
        team: { select: { id: true, name: true } },
      },
    })
  },

  async createUser(data: CreateUserData): Promise<User> {
    const prisma = getPrisma()!
    return prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        contactNumber: data.contactNumber,
        passwordHash: data.passwordHash,
        role: data.role ?? Role.USER,
      },
    })
  },

  async createSession(data: CreateSessionData) {
    const prisma = getPrisma()!
    return prisma.session.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        refreshTokens: { create: { tokenHash: data.tokenHash } },
      },
    })
  },

  async findSessionById(id: string) {
    const prisma = getPrisma()
    if (!prisma) return null
    return prisma.session.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            headOf: { select: { id: true } },
            department: {
              select: { id: true, name: true, code: true, color: true },
            },
            team: { select: { id: true, name: true } },
          },
        },
      },
    })
  },

  async rotateRefreshToken(currentHash: string, nextHash: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash: currentHash },
        include: { session: { include: { user: true } } },
      })
      if (!record) return null
      const { session } = record
      if (
        record.consumedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive ||
        session.user.accountDeletedAt !== null
      ) {
        await tx.session.deleteMany({ where: { id: session.id } })
        return null
      }
      // Comparing the current hash serializes concurrent rotations of this family.
      const claimed = await tx.session.updateMany({
        where: {
          id: session.id,
          tokenHash: currentHash,
          expiresAt: { gt: new Date() },
          user: { isActive: true, accountDeletedAt: null },
        },
        data: { tokenHash: nextHash },
      })
      if (claimed.count !== 1) {
        await tx.session.deleteMany({ where: { id: session.id } })
        return null
      }
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      })
      await tx.refreshToken.create({
        data: { tokenHash: nextHash, sessionId: session.id },
      })
      return session
    })
  },

  async deleteSession(sessionId: string) {
    const prisma = getPrisma()!
    return prisma.session.deleteMany({ where: { id: sessionId } })
  },

  async updatePasswordAndRevokeSessions(userId: string, passwordHash: string) {
    const prisma = getPrisma()!
    return prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ])
  },
}
