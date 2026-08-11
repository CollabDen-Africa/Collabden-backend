const {
  getEscrows,
  getEscrowById,
} = require("../services/adminEscrow.service");

const getEscrowsController = async (req, res) => {
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

    const data = await getEscrows(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getEscrowsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch escrow records" });
  }
};

const getEscrowByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const escrow = await getEscrowById(id);
    res.status(200).json(escrow);
  } catch (error) {
    console.error("Error in getEscrowByIdController:", error);
    res.status(error.message === "Escrow record not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch escrow details",
    });
  }
};

module.exports = {
  getEscrowsController,
  getEscrowByIdController,
};
