import mongoose from "mongoose";

const txnSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  amount: Number,
  category: String,
  date: Date,
  note: String
});

export default mongoose.model("Transaction", txnSchema);
