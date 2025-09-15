import express from "express";
import Budget from "../models/Budget.js";
import { Parser } from "json2csv";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/* ===========================
   CREATE NEW BUDGET
=========================== */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const budget = new Budget({ ...req.body, userId: req.user.id });
    await budget.save();
    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: "Error adding budget" });
  }
});

/* ===========================
   GET ALL BUDGETS (by month)
=========================== */
router.get("/:month", authMiddleware, async (req, res) => {
  try {
    const { month } = req.params;
    const budgets = await Budget.find({ userId: req.user.id, month });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: "Error fetching budgets" });
  }
});

/* ===========================
   UPDATE A BUDGET
=========================== */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: "Error updating budget" });
  }
});

/* ===========================
   DELETE A BUDGET
=========================== */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    res.json({ message: "Budget deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting budget" });
  }
});

/* ===========================
   EXPORT BUDGETS TO CSV
=========================== */
router.get("/export/csv", authMiddleware, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.id });
    const parser = new Parser();
    const csv = parser.parse(budgets);
    res.header("Content-Type", "text/csv");
    res.attachment("budgets.csv");
    return res.send(csv);
  } catch {
    res.status(500).json({ message: "Error exporting CSV" });
  }
});

export default router;
