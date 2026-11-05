/**
 * Instance unique du client Prisma (évite d'ouvrir plusieurs connexions).
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
