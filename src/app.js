import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import { isOriginAllowed } from "./config/cors.js";
import connectDB from "./db/connect.js";

const app = express();

app.set("trust proxy", 1);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({
      success: false,
      message: "Database unavailable",
    });
  }
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json());

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Interview AI API Running",
  });
});

app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    db: ready ? "connected" : "disconnected",
    env: {
      mongo: Boolean(process.env.MONGODB_URI),
      jwt: Boolean(process.env.JWT_SECRET),
    },
  });
});

export default app;
