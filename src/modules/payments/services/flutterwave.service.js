const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

/**
 * Get configured axios instance for Flutterwave API calls.
 * Uses the secret key from environment variables.
 */
const getFlwClient = () => {
  return axios.create({
    baseURL: FLW_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
};

/**
 * Generate a unique transaction reference for Flutterwave.
 * Format: COLLAB-<type>-<uuid>
 * @param {string} type - Transaction type prefix (e.g., "FUND", "PAYOUT")
 * @returns {string} Unique transaction reference
 */
const generateTxRef = (type = "TXN") => {
  return `COLLAB-${type}-${uuidv4()}`;
};

/**
 * Initialize a payment with Flutterwave.
 * Creates a payment link that the user is redirected to.
 * Supports card, bank transfer, and USSD payment methods.
 *
 * @param {object} params
 * @param {string} params.userId - Internal user ID
 * @param {number} params.amount - Amount in NGN
 * @param {string} params.email - User's email address
 * @param {string} params.paymentMethod - Payment method (card, banktransfer, ussd)
 * @returns {object} { paymentLink, txRef } - Flutterwave payment link and transaction reference
 */
const initializePayment = async ({ userId, amount, email, paymentMethod }) => {
  const txRef = generateTxRef("FUND");
  const redirectUrl = process.env.FLW_REDIRECT_URL;

  const flwClient = getFlwClient();

  const response = await flwClient.post("/payments", {
    tx_ref: txRef,
    amount,
    currency: "NGN",
    redirect_url: redirectUrl,
    payment_options: paymentMethod,
    customer: {
      email,
    },
    customizations: {
      title: "CollabDen Wallet Funding",
      description: `Fund your CollabDen wallet with ₦${amount.toLocaleString()}`,
      logo: "https://collabden.com/logo.png",
    },
    meta: {
      user_id: userId,
      type: "FUNDING",
    },
  });

  if (response.data.status !== "success") {
    throw new Error("Failed to initialize payment with Flutterwave.");
  }

  return {
    paymentLink: response.data.data.link,
    txRef,
  };
};

/**
 * Verify a payment transaction with Flutterwave.
 * Calls the Flutterwave API to confirm the transaction status.
 *
 * @param {string} transactionId - Flutterwave transaction ID
 * @returns {object} Flutterwave transaction data
 */
const verifyPayment = async (transactionId) => {
  const flwClient = getFlwClient();

  const response = await flwClient.get(`/transactions/${transactionId}/verify`);

  if (response.data.status !== "success") {
    throw new Error("Payment verification failed.");
  }

  return response.data.data;
};

/**
 * Validate a Flutterwave webhook payload.
 * Compares the hash header against the configured webhook secret.
 *
 * @param {string} receivedHash - Hash from the request header (verif-hash)
 * @returns {boolean} Whether the hash is valid
 */
const validateWebhookHash = (receivedHash) => {
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  if (!secretHash || !receivedHash) return false;
  return receivedHash === secretHash;
};

/**
 * Verify a bank account using Flutterwave's account resolution API.
 * Returns the resolved account name for user confirmation.
 *
 * @param {string} accountNumber - 10-digit bank account number
 * @param {string} bankCode - Bank code from Flutterwave's bank list
 * @returns {object} { accountNumber, accountName } - Resolved bank details
 */
const verifyBankAccount = async (accountNumber, bankCode) => {
  const flwClient = getFlwClient();

  const response = await flwClient.post("/accounts/resolve", {
    account_number: accountNumber,
    account_bank: bankCode,
  });

  if (response.data.status !== "success") {
    throw new Error("Bank account verification failed.");
  }

  return {
    accountNumber: response.data.data.account_number,
    accountName: response.data.data.account_name,
  };
};

/**
 * Initiate a payout (withdrawal) to a bank account via Flutterwave.
 *
 * @param {object} params
 * @param {string} params.accountNumber - Recipient bank account number
 * @param {string} params.bankCode - Recipient bank code
 * @param {number} params.amount - Amount to transfer in NGN
 * @param {string} params.reference - Unique transaction reference
 * @param {string} params.narration - Transfer narration/description
 * @returns {object} Flutterwave transfer response data
 */
const initiatePayout = async ({ accountNumber, bankCode, amount, reference, narration }) => {
  const flwClient = getFlwClient();

  const response = await flwClient.post("/transfers", {
    account_bank: bankCode,
    account_number: accountNumber,
    amount,
    currency: "NGN",
    reference,
    narration: narration || "CollabDen Wallet Withdrawal",
    callback_url: `${process.env.FLW_REDIRECT_URL}`,
    debit_currency: "NGN",
  });

  if (response.data.status !== "success") {
    throw new Error("Payout initiation failed.");
  }

  return response.data.data;
};

/**
 * Fetch the list of supported Nigerian banks from Flutterwave.
 *
 * @returns {Array} List of banks with code and name
 */
const fetchBanks = async () => {
  const flwClient = getFlwClient();

  const response = await flwClient.get("/banks/NG");

  if (response.data.status !== "success") {
    throw new Error("Failed to fetch bank list.");
  }

  return response.data.data.map((bank) => ({
    code: bank.code,
    name: bank.name,
  }));
};

module.exports = {
  generateTxRef,
  initializePayment,
  verifyPayment,
  validateWebhookHash,
  verifyBankAccount,
  initiatePayout,
  fetchBanks,
};
