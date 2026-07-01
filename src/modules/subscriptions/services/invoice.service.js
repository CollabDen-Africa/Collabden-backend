const prisma = require("../../../config/prismaClient");
const { v4: uuidv4 } = require("uuid");

const generateInvoiceNumber = () => {
  return `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
};

const createInvoice = async ({
  userId,
  amount,
  currency = "NGN",
  status = "PENDING",
  billingCycle,
  tier,
  periodStart,
  periodEnd,
  paidAt,
}) => {
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      invoiceNumber: generateInvoiceNumber(),
      amount,
      currency,
      status,
      billingCycle,
      tier,
      periodStart,
      periodEnd,
      paidAt,
    },
  });

  return invoice;
};

const getBillingHistory = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({
      where: { userId },
    }),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getInvoiceById = async (userId, invoiceId) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.userId !== userId) throw new Error("Unauthorized.");

  return invoice;
};

const generateInvoicePDF = async (userId, invoiceId) => {
  const invoice = await getInvoiceById(userId, invoiceId);
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });

  return {
    companyInfo: {
      name: "CollabDen Africa",
      email: "support@collabden.com",
      website: "https://collabden.com",
    },
    customerInfo: {
      name: user.displayName || user.legalName || "Customer",
      email: user.email,
    },
    invoiceDetails: {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt,
      status: invoice.status,
      paidAt: invoice.paidAt,
    },
    lineItems: [
      {
        description: `CollabDen ${invoice.tier} Plan - ${invoice.billingCycle}`,
        period: `${invoice.periodStart.toISOString().split("T")[0]} to ${invoice.periodEnd.toISOString().split("T")[0]}`,
        amount: invoice.amount,
      },
    ],
    totalAmount: invoice.amount,
    currency: invoice.currency,
  };
};

module.exports = {
  createInvoice,
  getBillingHistory,
  getInvoiceById,
  generateInvoicePDF,
};
