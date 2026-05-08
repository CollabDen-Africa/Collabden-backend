const prisma = require("../../../config/prismaClient");

const sendConnectionRequest = async (senderId, receiverId) => {
  if (senderId === receiverId) {
    throw new Error("You cannot send a connection request to yourself.");
  }

  // Check if receiver exists
  const receiver = await prisma.userProfile.findUnique({
    where: { id: receiverId },
  });
  if (!receiver) throw new Error("User not found.");

  // Check if connection already exists
  const existingConnection = await prisma.userConnection.findFirst({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  });

  if (existingConnection) {
    if (existingConnection.status === "ACCEPTED") {
      throw new Error("You are already connected with this user.");
    }
    throw new Error("A connection request is already pending.");
  }

  return await prisma.userConnection.create({
    data: {
      senderId,
      receiverId,
      status: "PENDING",
    },
  });
};

const respondToConnectionRequest = async (connectionId, userId, status) => {
  const connection = await prisma.userConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) throw new Error("Connection request not found.");
  if (connection.receiverId !== userId) throw new Error("Unauthorized to respond to this request.");
  if (connection.status !== "PENDING") throw new Error("Request has already been processed.");

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status. Must be ACCEPTED or REJECTED.");
  }

  return await prisma.userConnection.update({
    where: { id: connectionId },
    data: { status },
  });
};

const getConnections = async (userId) => {
  const connections = await prisma.userConnection.findMany({
    where: {
      OR: [
        { senderId: userId, status: "ACCEPTED" },
        { receiverId: userId, status: "ACCEPTED" },
      ],
    },
    include: {
      sender: {
        select: { id: true, email: true },
      },
      receiver: {
        select: { id: true, email: true },
      },
    },
  });

  // Map to return the other user's info
  return connections.map(conn => {
    return conn.senderId === userId ? conn.receiver : conn.sender;
  });
};

const getPendingRequests = async (userId) => {
  return await prisma.userConnection.findMany({
    where: {
      receiverId: userId,
      status: "PENDING",
    },
    include: {
      sender: {
        select: { id: true, email: true },
      },
    },
  });
};

module.exports = {
  sendConnectionRequest,
  respondToConnectionRequest,
  getConnections,
  getPendingRequests,
};
