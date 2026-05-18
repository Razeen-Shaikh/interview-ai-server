import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import { isOriginAllowed } from "./config/cors.js";
import connectDB from "./db/connect.js";
import { debugLog } from "./utils/debugLog.js";

const app = express();

app.set("trust proxy", 1);

async function requireDb(req, res, next) {
  try {
    await connectDB();
    debugLog(
      "app.js:requireDb",
      "db connected",
      { path: req.path, method: req.method },
      "C",
    );
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    debugLog(
      "app.js:requireDb",
      "db connection failed",
      { path: req.path, error: error.message },
      "C",
    );
    res.status(503).json({
      success: false,
      message: "Database unavailable",
    });
  }
}

app.use(
  cors({
    origin(origin, callback) {
      const allowed = !origin || isOriginAllowed(origin);
      debugLog(
        "app.js:cors",
        "cors origin check",
        {
          origin: origin ?? "(none)",
          allowed,
          method: "OPTIONS_OR_PREFLIGHT",
        },
        "D",
      );
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed) {
        callback(null, origin);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json());

app.use(cookieParser());

app.use("/api/auth", requireDb, authRoutes);
app.use("/api/interview", requireDb, interviewRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Interview AI API Running",
  });
});

app.get("/api/health", async (req, res) => {
  let db = "disconnected";
  let dbError = null;
  try {
    await connectDB();
    db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  } catch (error) {
    db = "error";
    dbError = error.message;
    console.error("health check:", error.message);
    debugLog(
      "app.js:health",
      "health db error",
      { dbError: error.message },
      "C",
      "post-fix",
    );
  }

  res.json({
    success: true,
    db,
    dbError,
    env: {
      mongo: Boolean(process.env.MONGODB_URI?.trim()),
      jwt: Boolean(process.env.JWT_SECRET),
    },
  });
});

export default app;
