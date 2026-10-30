import { AuditAction, Role, type User } from "../../generated/prisma/client.js"
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
      },
    })
  },

  async findSessionByTokenHash(tokenHash: string) {
    const prisma = getPrisma()
    if (!prisma) return null
    return prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            department: {
              select: { id: true, name: true, code: true, color: true },
            },
            team: { select: { id: true, name: true } },
          },
        },
      },
    })
  },

  async deleteSession(sessionId: string) {
    const prisma = getPrisma()!
    return prisma.session.delete({ where: { id: sessionId } })
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

  async createPasswordResetToken(data: {
    tokenHash: string
    userId: string
    expiresAt: Date
  }) {
    const prisma = getPrisma()!
    return prisma.passwordResetToken.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    })
  },

  async findPasswordResetTokenByHash(tokenHash: string) {
    const prisma = getPrisma()!
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
  },

  async resetPasswordWithToken(data: {
    tokenId: string
    userId: string
    passwordHash: string
  }) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.userId },
        data: { passwordHash: data.passwordHash },
      })
      await tx.passwordResetToken.update({
        where: { id: data.tokenId },
        data: { usedAt: new Date() },
      })
      await tx.session.deleteMany({
        where: { userId: data.userId },
      })
      await tx.auditLog.create({
        data: {
          action: AuditAction.PASSWORD_RESET,
          targetUserId: data.userId,
        },
      })
    })
  },
}
