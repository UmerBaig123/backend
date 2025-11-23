import jwt from "jsonwebtoken";
import User from "../models/user.js";

// Session-based authentication middleware
export const requireAuth = (req, res, next) => {
  console.log("🔐 Auth Check:", {
    hasSession: !!req.session,
    sessionId: req.session?.id,
    userId: req.session?.userId,
    sessionData: req.session,
    cookies: req.headers.cookie,
    origin: req.headers.origin,
  });

  if (req.session && req.session.userId) {
    console.log("Auth Success - User ID:", req.session.userId);
    return next(); // User is authenticated, continue to the next middleware/route
  } else {
    console.log("Auth Failed - No valid session");
    return res.status(401).json({
      message: "Access denied. Please log in to continue.",
      isAuthenticated: false,
      debug: {
        hasSession: !!req.session,
        sessionExists: req.session ? "yes" : "no",
        userId: req.session?.userId || "none",
      },
    });
  }
};

// Optional auth middleware - doesn't block access but adds user info if available
export const optionalAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.user = {
      userId: req.session.userId,
      email: req.session.email,
    };
  }
  next();
};

// JWT-based authentication middleware (keeping for compatibility)
export const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, "secretkey123");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token." });
  }
};

export const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admins only." });
  }
};
