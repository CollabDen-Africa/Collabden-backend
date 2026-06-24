const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const walletService = require("./wallet.service");
const flutterwaveService = require("./flutterwave.service");

/**
 * Request a withdrawal from wallet to a registered bank account.
 * Validates balance, enforces minimum threshold, debits wallet, and initiates Flutterwave payout.
 */
const requestWithdrawal = async (userId, bankAccountId, amount) => {
  // 1. Verify bank account belongs to user
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
  });

  if (!bankAccount || bankAccount.isDeleted) {
    throw new Error("Bank account not found.");
  }
  if (bankAccount.userId !== userId) {
    throw new Error("Unauthorized: This bank account does not belong to you.");
  }

  // 2. Check wallet balance
  const wallet = await walletService.getOrCreateWallet(userId);
  if (Number(wallet.balance) < amount) {
    throw new Error("Insufficient wallet balance for this withdrawal.");
  }

  // 3. Minimum withdrawal threshold (₦1,000)
  if (amount < 1000) {
    throw new Error("Minimum withdrawal amount is ₦1,000.");
  }

  // 4. Generate reference and debit wallet
  const reference = flutterwaveService.generateTxRef("PAYOUT");

  const { transaction } = await walletService.debitWallet(
    userId,
    amount,
    "WITHDRAWAL",
    reference,
    `Withdrawal to ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
    { bankAccountId, bankName: bankAccount.bankName }
  );

  // 5. Create payment record for payout tracking
  await prisma.paymentRecord.create({
    data: {
      userId,
      txRef: reference,
      amount,
      currency: "NGN",
      status: "PROCESSING",
      type: "PAYOUT",
      flutterwaveData: { bankAccountId },
    },
  });

  // 6. Update transaction to PENDING (awaiting Flutterwave confirmation)
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "PENDING" },
  });

  // 7. Initiate payout via Flutterwave
  try {
    await flutterwaveService.initiatePayout({
      accountNumber: bankAccount.accountNumber,
      bankCode: bankAccount.bankCode,
      amount,
      reference,
      narration: `CollabDen withdrawal to ${bankAccount.accountName}`,
    });
  } catch (error) {
    // Reverse the debit if Flutterwave payout fails to initiate
    await walletService.creditWallet(
      userId,
      amount,
      "WITHDRAWAL",
      `${reference}-REVERSAL`,
      "Withdrawal payout initiation failed — funds reversed",
      { originalReference: reference, error: error.message }
    );

    await prisma.paymentRecord.update({
      where: { txRef: reference },
      data: { status: "FAILED" },
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED" },
    });

    throw new Error("Withdrawal failed. Your funds have been returned to your wallet.");
  }

  // 8. Publish event for notification
  await publishEvent(EVENT_TYPES.WITHDRAWAL_INITIATED, {
    userId,
    amount,
    bankName: bankAccount.bankName,
    accountNumber: bankAccount.accountNumber,
    reference,
  });

  return {
    message: "Withdrawal request submitted successfully. You will be notified once processed.",
    reference,
    amount,
    bankAccount: {
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      accountName: bankAccount.accountName,
    },
  };
};

/**
 * Get withdrawal history for a user.
 */
const getWithdrawalHistory = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [withdrawals, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: { userId, type: "PAYOUT" },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.paymentRecord.count({
      where: { userId, type: "PAYOUT" },
    }),
  ]);

  return {
    withdrawals,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

module.exports = { requestWithdrawal, getWithdrawalHistory };
