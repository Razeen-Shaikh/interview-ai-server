import bcrypt from "bcryptjs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { getAuthCookieOptions } from "../utils/cookieOptions.js";
import { debugLog } from "../utils/debugLog.js";

const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function authErrorResponse(error) {
  if (error.message === "JWT_SECRET is not set") {
    return { status: 500, message: "Server misconfigured" };
  }
  if (
    error.name === "MongooseError" ||
    /MongoNetwork|buffering timed out|Server selection/i.test(
      String(error.message),
    )
  ) {
    return { status: 503, message: "Database unavailable" };
  }
  return { status: 500, message: "Server Error" };
}

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const emailNormalized = String(email).trim().toLowerCase();

    // Check existing user
    const existingUser = await User.findOne({ email: emailNormalized });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name: String(name).trim(),
      email: emailNormalized,
      password: hashedPassword,
    });

    // Generate JWT
    const token = generateToken(user);

    // Send cookie (path must match clearCookie on logout)
    res.cookie(
      "token",
      token,
      getAuthCookieOptions(req, { maxAge: TOKEN_MAX_AGE }),
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("registerUser:", error.message);
    const { status, message } = authErrorResponse(error);
    res.status(status).json({ success: false, message });
  }
};

export const loginUser = async (req, res) => {
  debugLog(
    "auth.controller.js:login",
    "login handler entered",
    {
      method: req.method,
      origin: req.headers.origin ?? "(none)",
      hasCookie: Boolean(req.headers.cookie),
    },
    "C",
  );
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const emailNormalized = String(email).trim().toLowerCase();

    // Find user
    const user = await User.findOne({ email: emailNormalized });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user);

    const cookieOpts = getAuthCookieOptions(req, { maxAge: TOKEN_MAX_AGE });
    res.cookie("token", token, cookieOpts);

    debugLog(
      "auth.controller.js:login",
      "login success",
      {
        sameSite: cookieOpts.sameSite,
        secure: cookieOpts.secure,
        userFound: true,
      },
      "E",
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("loginUser:", error.message);
    const { status, message } = authErrorResponse(error);
    debugLog(
      "auth.controller.js:login",
      "login error",
      { status, errorName: error.name, errorMessage: error.message },
      "C",
    );
    res.status(status).json({ success: false, message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("token", getAuthCookieOptions(req));

    res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
