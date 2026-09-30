const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const walletService = require("../../payments/services/wallet.service");
const invoiceService = require("./invoice.service");
const supabase = require("../../../config/supabase");

const calculateUserStorageGB = async (userId) => {
  if (!supabase) return 0;
  
  const BUCKETS = ["user-avatars", "agreements", "project-files", "messaging-attachments"];
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    try {
      const { data } = await supabase.storage.from(bucket).list(userId, {
        limit: 100,
        offset: 0,
      });
      if (data && Array.isArray(data)) {
        for (const item of data) {
          if (item.metadata && item.metadata.size) {
            totalBytes += item.metadata.size;
          }
        }
      }
    } catch (err) {
      // Ignore missing bucket or permission errors
    }
  }

  const gb = totalBytes / (1024 * 1024 * 1024);
  return Math.max(0, Number(gb.toFixed(3)));
};


const getPlans = async () => {
  return await prisma.subscriptionPlan.findMany({
    orderBy: { priceMonthly: 'asc' },
  });
};

const getPlanByTier = async (tier) => {
  return await prisma.subscriptionPlan.findUnique({
    where: { tier },
  });
};

const getCurrentSubscription = async (userId) => {
  const usedStorageGB = await calculateUserStorageGB(userId);

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    const basicPlan = await getPlanByTier("BASIC");
    return {
      tier: "BASIC",
      status: "ACTIVE",
      plan: basicPlan,
      usedStorageGB,
    };
  }

  const plan = await getPlanByTier(subscription.tier);
  return {
    ...subscription,
    plan,
    usedStorageGB,
  };
};

const subscribe = async (userId, tier, billingCycle) => {
  if (tier === "BASIC") {
    return downgradeToBasic(userId);
  }

  const plan = await getPlanByTier(tier);
  if (!plan) throw new Error("Invalid subscription tier.");

  const amount = billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly;

  // 1. Debit Wallet
  const reference = `SUB-${Date.now()}-${userId.slice(-4)}`;
  await walletService.debitWallet(
    userId,
    amount,
    "ESCROW_DEBIT",
    reference,
    `${plan.name} Subscription (${billingCycle})`
  );

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "ANNUAL") {
    periodEnd.setFullYear(now.getFullYear() + 1);
  } else {
    periodEnd.setMonth(now.getMonth() + 1);
  }

  // 2. Create/Update Subscription
  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      tier,
      status: "ACTIVE",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
    create: {
      userId,
      tier,
      status: "ACTIVE",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  // 3. Update User Profile
  await prisma.userProfile.update({
    where: { id: userId },
    data: { tier },
  });

  // 4. Create Invoice
  await invoiceService.createInvoice({
    userId,
    amount,
    status: "PAID",
    billingCycle,
    tier,
    periodStart: now,
    periodEnd,
    paidAt: now,
  });

  // 5. Publish Event
  await publishEvent(EVENT_TYPES.SUBSCRIPTION_ACTIVATED, {
    userId,
    tier,
    amount,
    periodEnd,
  });

  return { message: "Subscription activated successfully", subscription };
};

const cancelSubscription = async (userId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || subscription.tier === "BASIC") {
    throw new Error("No active premium subscription to cancel.");
  }

  const updated = await prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
    },
  });

  await publishEvent(EVENT_TYPES.SUBSCRIPTION_CANCELLED, {
    userId,
    tier: subscription.tier,
    periodEnd: updated.currentPeriodEnd,
  });

  return { message: "Subscription will be cancelled at the end of the billing period", subscription: updated };
};

const reactivateSubscription = async (userId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || !subscription.cancelAtPeriodEnd) {
    throw new Error("No pending cancellation to reactivate.");
  }

  const updated = await prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: false,
      canceledAt: null,
    },
  });

  return { message: "Subscription reactivated successfully", subscription: updated };
};

const downgradeToBasic = async (userId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { userId },
      data: {
        tier: "BASIC",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
  }

  await prisma.userProfile.update({
    where: { id: userId },
    data: { tier: "BASIC" },
  });

  return { message: "Downgraded to Basic plan successfully" };
};

module.exports = {
  getPlans,
  getPlanByTier,
  getCurrentSubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
  downgradeToBasic,
};
