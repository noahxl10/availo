import { PrismaClient } from "@prisma/client";
import { cleanupExpiredReservations } from "./expired-reservations.js";

const prisma = new PrismaClient();

cleanupExpiredReservations(prisma)
  .then(async (result) => {
    console.log(JSON.stringify(result));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
