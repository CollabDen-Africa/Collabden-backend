const {
  getWithdrawals,
  getWithdrawalById,
  getSubscriptionPayments,
  getSubscriptionPaymentById,
} = require("../services/adminWithdrawals.service");

const getWithdrawalsController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      dateStart,
      dateEnd,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
      dateStart,
      dateEnd,
      sortBy,
      sortOrder,
    };

    const data = await getWithdrawals(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getWithdrawalsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch withdrawals" });
  }
};

const getWithdrawalByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await getWithdrawalById(id);
    res.status(200).json(withdrawal);
  } catch (error) {
    console.error("Error in getWithdrawalByIdController:", error);
    res.status(error.message === "Withdrawal request not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch withdrawal details",
    });
  }
};

const getSubscriptionPaymentsController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      tier,
      billingCycle,
      dateStart,
      dateEnd,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
      tier,
      billingCycle,
      dateStart,
      dateEnd,
      sortBy,
      sortOrder,
    };

    const data = await getSubscriptionPayments(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getSubscriptionPaymentsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch subscription payments" });
  }
};

const getSubscriptionPaymentByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await getSubscriptionPaymentById(id);
    res.status(200).json(invoice);
  } catch (error) {
    console.error("Error in getSubscriptionPaymentByIdController:", error);
    res.status(error.message === "Subscription payment record not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch subscription payment details",
    });
  }
};

module.exports = {
  getWithdrawalsController,
  getWithdrawalByIdController,
  getSubscriptionPaymentsController,
  getSubscriptionPaymentByIdController,
};
