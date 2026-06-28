const subscriptionService = require("../services/subscription.service");
const invoiceService = require("../services/invoice.service");
const paymentMethodService = require("../services/paymentMethod.service");


const getPlans = async (req, res) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMySubscription = async (req, res) => {
  try {
    const subscription = await subscriptionService.getCurrentSubscription(req.user.id);
    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const subscribe = async (req, res) => {
  try {
    const { tier, billingCycle } = req.body;
    const result = await subscriptionService.subscribe(req.user.id, tier, billingCycle);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const result = await subscriptionService.cancelSubscription(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const reactivateSubscription = async (req, res) => {
  try {
    const result = await subscriptionService.reactivateSubscription(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//Billing & Invoices

const getBillingHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await invoiceService.getBillingHistory(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invoiceService.getInvoiceById(req.user.id, id);
    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const pdfData = await invoiceService.generateInvoicePDF(req.user.id, id);
    res.status(200).json(pdfData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//Payment Methods
const savePaymentMethod = async (req, res) => {
  try {
    const result = await paymentMethodService.savePaymentMethod(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const listPaymentMethods = async (req, res) => {
  try {
    const result = await paymentMethodService.listPaymentMethods(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await paymentMethodService.setDefaultPaymentMethod(req.user.id, id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await paymentMethodService.removePaymentMethod(req.user.id, id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getPlans,
  getMySubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
  getBillingHistory,
  getInvoice,
  generateInvoicePDF,
  savePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
};
