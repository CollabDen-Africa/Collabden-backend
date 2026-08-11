const {
  getTransactions,
  getTransactionById,
} = require("../services/adminTransactions.service");

const getTransactionsController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      type,
      status,
      dateStart,
      dateEnd,
      userId,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      type,
      status,
      dateStart,
      dateEnd,
      userId,
      sortBy,
      sortOrder,
    };

    const data = await getTransactions(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getTransactionsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch transactions" });
  }
};

const getTransactionByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await getTransactionById(id);
    res.status(200).json(transaction);
  } catch (error) {
    console.error("Error in getTransactionByIdController:", error);
    res.status(error.message === "Transaction not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch transaction details",
    });
  }
};

module.exports = {
  getTransactionsController,
  getTransactionByIdController,
};
