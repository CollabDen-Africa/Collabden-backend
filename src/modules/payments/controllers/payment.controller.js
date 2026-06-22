const walletService = require("../services/wallet.service");
const bankAccountService = require("../services/bankAccount.service");
const payoutService = require("../services/payout.service");

// ─── Wallet ─────────────────────────────────────────────────────────────────

const getWallet = async (req, res) => {
  try {
    const wallet = await walletService.getWalletBalance(req.user.id);
    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { type, status, page, limit } = req.query;
    const result = await walletService.getTransactionHistory(req.user.id, {
      type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Funding ────────────────────────────────────────────────────────────────

const initializeFunding = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const result = await walletService.initializeFunding(req.user.id, amount, paymentMethod);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const verifyFunding = async (req, res) => {
  try {
    const { transaction_id } = req.query;
    if (!transaction_id) {
      return res.status(400).json({ error: "transaction_id query parameter is required." });
    }
    const result = await walletService.verifyFunding(transaction_id, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Webhook ────────────────────────────────────────────────────────────────

const handleWebhook = async (req, res) => {
  try {
    const hash = req.headers["verif-hash"];
    const result = await walletService.processWebhook(req.body, hash);
    res.status(200).json(result);
  } catch (error) {
    console.error("[Webhook Error]", error.message);
    res.status(400).json({ error: error.message });
  }
};

// ─── Bank Accounts ──────────────────────────────────────────────────────────

const addBankAccount = async (req, res) => {
  try {
    const { bankCode, accountNumber } = req.body;
    const account = await bankAccountService.addBankAccount(req.user.id, bankCode, accountNumber);
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const listBankAccounts = async (req, res) => {
  try {
    const accounts = await bankAccountService.listBankAccounts(req.user.id);
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeBankAccount = async (req, res) => {
  try {
    const result = await bankAccountService.deleteBankAccount(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getSupportedBanks = async (req, res) => {
  try {
    const banks = await bankAccountService.getSupportedBanks();
    res.status(200).json(banks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Withdrawals ────────────────────────────────────────────────────────────

const requestWithdrawal = async (req, res) => {
  try {
    const { bankAccountId, amount } = req.body;
    const result = await payoutService.requestWithdrawal(req.user.id, bankAccountId, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getWithdrawals = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await payoutService.getWithdrawalHistory(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  initializeFunding,
  verifyFunding,
  handleWebhook,
  addBankAccount,
  listBankAccounts,
  removeBankAccount,
  getSupportedBanks,
  requestWithdrawal,
  getWithdrawals,
};
