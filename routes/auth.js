import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";


const router = express.Router();

// Signup
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed });
  await user.save();
  res.json({ message: "User registered" });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

export default router;

// Get profile
router.get("/me", authMiddleware, async (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email });
});

// Update profile (name only)
router.put("/me", authMiddleware, async (req, res) => {
  try {
    req.user.name = req.body.name || req.user.name;
    await req.user.save();
    res.json({ message: "Profile updated", user: req.user });
  } catch {
    res.status(500).json({ message: "Error updating profile" });
  }
});


// Verify token
router.get("/verify", authMiddleware, (req, res) => {
  res.json({ success: true });
});
