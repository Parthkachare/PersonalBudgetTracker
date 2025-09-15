import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Config
dotenv.config();

// Create app
const app = express();
app.use(cors());
app.use(express.json());

// For __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Routes
import authRoutes from "./routes/auth.js";
import txnRoutes from "./routes/transactions.js";
import budgetRoutes from "./routes/budgets.js";

app.use("/api/auth", authRoutes);
app.use("/api/transactions", txnRoutes);
app.use("/api/budgets", budgetRoutes);

// Default: send index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// DB + Server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => console.error(err));
