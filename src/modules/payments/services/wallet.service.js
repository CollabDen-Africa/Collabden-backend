const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const flutterwaveService = require("./flutterwave.service");

/**
 * Get or create a wallet for a user.
 * Wallets are lazily created on first payment interaction.
 *
 * @param {string} userId - The user's ID
 * @returns {object} The wallet record
 */
const getOrCreateWallet = async (userId) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0,
        currency: "NGN",
      },
    });
  }

  return wallet;
};

/**
 * Get the current wallet balance for a user.
 *
 * @param {string} userId - The user's ID
 * @returns {object} Wallet with balance details
 */
const getWalletBalance = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  return {
    id: wallet.id,
    balance: wallet.balance,
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  };
};

/**
 * Get paginated transaction history for a user.
 * Supports filtering by type and status.
 *
 * @param {string} userId - The user's ID
 * @param {object} filters - Query filters
 * @param {string} [filters.type] - Transaction type filter
 * @param {string} [filters.status] - Transaction status filter
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=20] - Items per page
 * @returns {object} { transactions, pagination }
 */
const getTransactionHistory = async (userId, filters = {}) => {
  const { type, status, page = 1, limit = 20 } = filters;

  const where = { userId };
  if (type) where.type = type;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Credit a user's wallet balance atomically.
 * Creates a transaction record and updates the wallet balance inside a Prisma transaction.
 *
 * @param {string} userId - The user's ID
 * @param {number} amount - Amount to credit
 * @param {string} type - Transaction type (e.g., FUNDING, ESCROW_CREDIT)
 * @param {string} reference - Unique transaction reference
 * @param {string} [description] - Optional transaction description
 * @param {object} [metadata] - Optional metadata
 * @returns {object} { transaction, wallet } - The created transaction and updated wallet
 */
const creditWallet = async (userId, amount, type, reference, description = null, metadata = {}) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Get or create wallet (inside transaction scope)
    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId, balance: 0, currency: "NGN" },
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = Number(balanceBefore) + Number(amount);

    // 2. Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: balanceAfter },
    });

    // 3. Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type,
        status: "COMPLETED",
        amount,
        balanceBefore,
        balanceAfter,
        reference,
        description,
        metadata,
      },
    });

    return { transaction, wallet: updatedWallet };
  });
};

/**
 * Debit a user's wallet balance atomically.
 * Verifies sufficient balance before deducting.
 *
 * @param {string} userId - The user's ID
 * @param {number} amount - Amount to debit
 * @param {string} type - Transaction type (e.g., WITHDRAWAL, ESCROW_DEBIT)
 * @param {string} reference - Unique transaction reference
 * @param {string} [description] - Optional transaction description
 * @param {object} [metadata] - Optional metadata
 * @returns {object} { transaction, wallet } - The created transaction and updated wallet
 */
const debitWallet = async (userId, amount, type, reference, description = null, metadata = {}) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Get wallet
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new Error("Wallet not found. Please fund your wallet first.");
    }

    const balanceBefore = Number(wallet.balance);

    // 2. Verify sufficient balance
    if (balanceBefore < Number(amount)) {
      throw new Error("Insufficient wallet balance.");
    }

    const balanceAfter = balanceBefore - Number(amount);

    // 3. Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: balanceAfter },
    });

    // 4. Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        userId,
        type,
        status: "COMPLETED",
        amount,
        balanceBefore,
        balanceAfter,
        reference,
        description,
        metadata,
      },
    });

    return { transaction, wallet: updatedWallet };
  });
};

/**
 * Initialize wallet funding via Flutterwave.
 * Creates a payment record and returns the Flutterwave payment link.
 *
 * @param {string} userId - The user's ID
 * @param {number} amount - Amount to fund
 * @param {string} paymentMethod - Payment method (card, banktransfer, ussd)
 * @returns {object} { paymentLink, txRef }
 */
const initializeFunding = async (userId, amount, paymentMethod) => {
  // 1. Get user email
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  // 2. Initialize Flutterwave payment
  const { paymentLink, txRef } = await flutterwaveService.initializePayment({
    userId,
    amount,
    email: user.email,
    paymentMethod,
  });

  // 3. Create payment record
  await prisma.paymentRecord.create({
    data: {
      userId,
      txRef,
      amount,
      currency: "NGN",
      paymentMethod,
      status: "PENDING",
      type: "FUNDING",
    },
  });

  return { paymentLink, txRef };
};

/**
 * Verify a funding payment after Flutterwave redirect.
 * Checks the transaction status and credits the wallet if successful.
 *
 * @param {string} transactionId - Flutterwave transaction ID
 * @param {string} userId - The user's ID (for authorization check)
 * @returns {object} { status, transaction }
 */
const verifyFunding = async (transactionId, userId) => {
  // 1. Verify with Flutterwave
  const flwData = await flutterwaveService.verifyPayment(transactionId);

  // 2. Find the payment record
  const paymentRecord = await prisma.paymentRecord.findUnique({
    where: { txRef: flwData.tx_ref },
  });

  if (!paymentRecord) {
    throw new Error("Payment record not found.");
  }

  if (paymentRecord.userId !== userId) {
    throw new Error("Unauthorized: This payment does not belong to you.");
  }

  // 3. Check if already processed
  if (paymentRecord.status === "COMPLETED") {
    return { status: "ALREADY_PROCESSED", message: "This payment has already been credited." };
  }

  // 4. Validate payment details
  if (
    flwData.status !== "successful" ||
    Number(flwData.amount) !== Number(paymentRecord.amount) ||
    flwData.currency !== "NGN"
  ) {
    // Update payment record as failed
    await prisma.paymentRecord.update({
      where: { txRef: flwData.tx_ref },
      data: {
        status: "FAILED",
        flwRef: flwData.flw_ref,
        flutterwaveData: flwData,
      },
    });
    throw new Error("Payment verification failed. Amount or currency mismatch.");
  }

  // 5. Credit wallet
  const { transaction, wallet } = await creditWallet(
    userId,
    Number(paymentRecord.amount),
    "FUNDING",
    paymentRecord.txRef,
    `Wallet funded via ${flwData.payment_type || "Flutterwave"}`,
    { flwRef: flwData.flw_ref, transactionId }
  );

  // 6. Update payment record
  await prisma.paymentRecord.update({
    where: { txRef: flwData.tx_ref },
    data: {
      status: "COMPLETED",
      flwRef: flwData.flw_ref,
      flutterwaveData: flwData,
    },
  });

  // 7. Publish event for notification
  await publishEvent(EVENT_TYPES.WALLET_FUNDED, {
    userId,
    amount: Number(paymentRecord.amount),
    newBalance: wallet.balance,
    reference: paymentRecord.txRef,
  });

  return {
    status: "SUCCESS",
    transaction,
    wallet: {
      balance: wallet.balance,
      currency: wallet.currency,
    },
  };
};

/**
 * Process a Flutterwave webhook notification.
 * Validates the hash, verifies the payment, and credits the wallet.
 *
 * @param {object} payload - Webhook payload from Flutterwave
 * @param {string} hash - Webhook verification hash from request headers
 * @returns {object} Processing result
 */
const processWebhook = async (payload, hash) => {
  // 1. Validate webhook hash
  if (!flutterwaveService.validateWebhookHash(hash)) {
    throw new Error("Invalid webhook signature.");
  }

  const { event, data } = payload;

  // 2. Handle charge completion (wallet funding)
  if (event === "charge.completed" && data.status === "successful") {
    const txRef = data.tx_ref;

    // Find the payment record
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { txRef },
    });

    if (!paymentRecord) {
      console.log(`[Webhook] No payment record found for tx_ref: ${txRef}`);
      return { status: "IGNORED", reason: "No matching payment record." };
    }

    // Check if already processed
    if (paymentRecord.status === "COMPLETED") {
      return { status: "ALREADY_PROCESSED" };
    }

    // Verify the transaction with Flutterwave
    const flwData = await flutterwaveService.verifyPayment(data.id);

    // Validate payment details
    if (
      flwData.status !== "successful" ||
      Number(flwData.amount) !== Number(paymentRecord.amount) ||
      flwData.currency !== "NGN"
    ) {
      await prisma.paymentRecord.update({
        where: { txRef },
        data: {
          status: "FAILED",
          flwRef: flwData.flw_ref,
          flutterwaveData: flwData,
        },
      });
      return { status: "FAILED", reason: "Verification mismatch." };
    }

    // Credit the wallet
    const { transaction, wallet } = await creditWallet(
      paymentRecord.userId,
      Number(paymentRecord.amount),
      "FUNDING",
      txRef,
      `Wallet funded via ${flwData.payment_type || "Flutterwave"} (webhook)`,
      { flwRef: flwData.flw_ref, transactionId: data.id }
    );

    // Update payment record
    await prisma.paymentRecord.update({
      where: { txRef },
      data: {
        status: "COMPLETED",
        flwRef: flwData.flw_ref,
        flutterwaveData: flwData,
      },
    });

    // Publish event for notification
    await publishEvent(EVENT_TYPES.WALLET_FUNDED, {
      userId: paymentRecord.userId,
      amount: Number(paymentRecord.amount),
      newBalance: wallet.balance,
      reference: txRef,
    });

    return { status: "SUCCESS", transactionId: transaction.id };
  }

  // 3. Handle transfer completion (withdrawal payouts)
  if (event === "transfer.completed") {
    const reference = data.reference;

    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { txRef: reference },
    });

    if (!paymentRecord) {
      return { status: "IGNORED", reason: "No matching payout record." };
    }

    if (data.status === "SUCCESSFUL") {
      // Update payment record
      await prisma.paymentRecord.update({
        where: { txRef: reference },
        data: {
          status: "COMPLETED",
          flutterwaveData: data,
        },
      });

      // Update the pending transaction to completed
      await prisma.transaction.updateMany({
        where: { reference, status: "PENDING" },
        data: { status: "COMPLETED" },
      });

      // Publish event
      await publishEvent(EVENT_TYPES.WITHDRAWAL_COMPLETED, {
        userId: paymentRecord.userId,
        amount: Number(paymentRecord.amount),
        reference,
      });
    } else {
      // Payout failed — reverse the wallet debit
      const { wallet } = await creditWallet(
        paymentRecord.userId,
        Number(paymentRecord.amount),
        "WITHDRAWAL",
        `${reference}-REVERSAL`,
        "Withdrawal payout failed — funds reversed",
        { originalReference: reference, failureData: data }
      );

      // Update payment record as failed
      await prisma.paymentRecord.update({
        where: { txRef: reference },
        data: {
          status: "FAILED",
          flutterwaveData: data,
        },
      });

      // Update the pending transaction to failed
      await prisma.transaction.updateMany({
        where: { reference, status: "PENDING" },
        data: { status: "FAILED" },
      });

      // Publish event
      await publishEvent(EVENT_TYPES.WITHDRAWAL_FAILED, {
        userId: paymentRecord.userId,
        amount: Number(paymentRecord.amount),
        reference,
        reason: data.complete_message || "Payout failed",
      });
    }

    return { status: "PROCESSED" };
  }

  return { status: "IGNORED", reason: `Unhandled event: ${event}` };
};

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  getTransactionHistory,
  creditWallet,
  debitWallet,
  initializeFunding,
  verifyFunding,
  processWebhook,
};
