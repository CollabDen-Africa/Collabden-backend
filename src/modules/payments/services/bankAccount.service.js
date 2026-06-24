const prisma = require("../../../config/prismaClient");
const flutterwaveService = require("./flutterwave.service");

const addBankAccount = async (userId, bankCode, accountNumber) => {
  const existing = await prisma.bankAccount.findFirst({
    where: { userId, bankCode, accountNumber, isDeleted: false },
  });
  if (existing) throw new Error("This bank account is already registered.");

  const verified = await flutterwaveService.verifyBankAccount(accountNumber, bankCode);

  let bankName = bankCode;
  try {
    const banks = await flutterwaveService.fetchBanks();
    const bank = banks.find((b) => b.code === bankCode);
    if (bank) bankName = bank.name;
  } catch { bankName = bankCode; }

  const accountCount = await prisma.bankAccount.count({
    where: { userId, isDeleted: false },
  });

  return await prisma.bankAccount.create({
    data: {
      userId, bankCode, bankName, accountNumber,
      accountName: verified.accountName,
      isDefault: accountCount === 0,
    },
  });
};

const listBankAccounts = async (userId) => {
  return await prisma.bankAccount.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, bankCode: true, bankName: true,
      accountNumber: true, accountName: true,
      isDefault: true, createdAt: true,
    },
  });
};

const deleteBankAccount = async (userId, accountId) => {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Bank account not found.");
  if (account.userId !== userId) throw new Error("Unauthorized: This bank account does not belong to you.");
  if (account.isDeleted) throw new Error("Bank account already deleted.");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: { isDeleted: true },
  });
  return { success: true, message: "Bank account removed successfully." };
};

const getSupportedBanks = async () => {
  return await flutterwaveService.fetchBanks();
};

module.exports = { addBankAccount, listBankAccounts, deleteBankAccount, getSupportedBanks };
