import express from "express";
import Transaction from "../models/Transaction.js";
import { Parser } from "json2csv";
import authMiddleware from "../middleware/authMiddleware.js";


const router = express.Router();

// ➕ Add transaction
router.post("/", authMiddleware, async (req, res) => {
  try {
    const txn = new Transaction({ ...req.body, userId: req.user.id });
    await txn.save();
    res.json(txn);
  } catch (err) {
    res.status(500).json({ message: "Error adding transaction" });
  }
});

// 📜 Get all transactions
router.get("/", authMiddleware, async (req, res) => {
  try {
    const txns = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ message: "Error fetching transactions" });
  }
});

// 📊 Summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const txns = await Transaction.find({ userId: req.user.id });

    const income = txns.filter(t => t.type === "income").reduce((a, b) => a + b.amount, 0);
    const expense = txns.filter(t => t.type === "expense").reduce((a, b) => a + b.amount, 0);
    const savings = income - expense;

    const categoryBreakdown = txns.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    res.json({
      income,
      expense,
      savings,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([k, v]) => ({
        _id: k,
        total: v,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Error generating summary" });
  }
});

// ✏️ Update transaction
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const txn = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!txn) return res.status(404).json({ message: "Transaction not found" });
    res.json(txn);
  } catch (err) {
    res.status(500).json({ message: "Error updating transaction" });
  }
});

// ❌ Delete transaction
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const txn = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!txn) return res.status(404).json({ message: "Transaction not found" });
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting transaction" });
  }
});

// 🔍 Search & filter transactions
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const { category, startDate, endDate, keyword } = req.query;
    let query = { userId: req.user.id };

    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (keyword) {
      query.note = { $regex: keyword, $options: "i" }; // case-insensitive
    }

    const txns = await Transaction.find(query).sort({ date: -1 });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ message: "Error filtering transactions" });
  }
});

// 📥 Export transactions as CSV
router.get("/export/csv", authMiddleware, async (req, res) => {
  try {
    const txns = await Transaction.find({ userId: req.user.id });
    const parser = new Parser();
    const csv = parser.parse(txns);
    res.header("Content-Type", "text/csv");
    res.attachment("transactions.csv");
    return res.send(csv);
  } catch {
    res.status(500).json({ message: "Error exporting CSV" });
  }
});

export default router;
