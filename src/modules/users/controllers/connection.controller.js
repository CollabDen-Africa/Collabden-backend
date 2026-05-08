const {
  sendConnectionRequest,
  respondToConnectionRequest,
  getConnections,
  getPendingRequests,
} = require("../services/connection.service");

const sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({ error: "Receiver ID is required" });
    }

    const connection = await sendConnectionRequest(senderId, receiverId);
    res.status(201).json({
      message: "Connection request sent successfully",
      connection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const respondRequest = async (req, res) => {
  try {
    const { id: connectionId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const connection = await respondToConnectionRequest(connectionId, userId, status);
    res.status(200).json({
      message: `Connection request ${status.toLowerCase()} successfully`,
      connection,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const connections = await getConnections(userId);
    res.status(200).json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await getPendingRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  sendRequest,
  respondRequest,
  listConnections,
  listPendingRequests,
};
