const prisma = require("../../../config/prismaClient");

const savePaymentMethod = async (userId, data) => {
  const { token, last4, brand, expMonth, expYear, type = "CARD" } = data;

  // Check if this is the first payment method
  const count = await prisma.savedPaymentMethod.count({
    where: { userId, isDeleted: false },
  });

  const paymentMethod = await prisma.savedPaymentMethod.create({
    data: {
      userId,
      token,
      last4,
      brand,
      expMonth,
      expYear,
      type,
      isDefault: count === 0, // Set default if it's the first one
    },
  });

  return paymentMethod;
};

const listPaymentMethods = async (userId) => {
  return await prisma.savedPaymentMethod.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
  });
};

const setDefaultPaymentMethod = async (userId, methodId) => {
  const method = await prisma.savedPaymentMethod.findUnique({
    where: { id: methodId },
  });

  if (!method || method.isDeleted) throw new Error("Payment method not found.");
  if (method.userId !== userId) throw new Error("Unauthorized.");

  // Remove default from all other methods
  await prisma.savedPaymentMethod.updateMany({
    where: { userId },
    data: { isDefault: false },
  });

  // Set this method as default
  const updated = await prisma.savedPaymentMethod.update({
    where: { id: methodId },
    data: { isDefault: true },
  });

  return updated;
};

const removePaymentMethod = async (userId, methodId) => {
  const method = await prisma.savedPaymentMethod.findUnique({
    where: { id: methodId },
  });

  if (!method) throw new Error("Payment method not found.");
  if (method.userId !== userId) throw new Error("Unauthorized.");
  if (method.isDeleted) throw new Error("Already deleted.");

  await prisma.savedPaymentMethod.update({
    where: { id: methodId },
    data: { isDeleted: true },
  });

  // If we deleted the default, set another one as default
  if (method.isDefault) {
    const nextMethod = await prisma.savedPaymentMethod.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    if (nextMethod) {
      await prisma.savedPaymentMethod.update({
        where: { id: nextMethod.id },
        data: { isDefault: true },
      });
    }
  }

  return { message: "Payment method removed successfully." };
};

module.exports = {
  savePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
};
