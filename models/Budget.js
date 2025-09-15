import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  category: String,
  limit: Number,
  month: String
});

export default mongoose.model("Budget", budgetSchema);
