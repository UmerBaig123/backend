import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
// import documentRoutes from './routes/documentRoutes.js';
import bidRoutes from "./routes/bidRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import pricesheetRoutes from "./routes/pricesheetRoutes.js";
import templatesRoutes from "./routes/templateRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import totalProposedAmountRoutes from "./routes/totalProposedAmountRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const isProduction = process.env.NODE_ENV === "production";
console.log("Environment:", isProduction ? "Production" : "Development");

app.use((req, res, next) => {
  // Set CORS headers for every request
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires"
  );
  res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    console.log("✅ Preflight OPTIONS request for:", req.path);
    console.log("✅ Origin:", req.headers.origin || "No origin");
    console.log(
      "✅ Requested headers:",
      req.headers["access-control-request-headers"] || "None"
    );
    res.status(200).end();
    return;
  }
  next();
});

// CORS configuration optimized for session handling
const allowedOrigins = isProduction
  ? process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["https://yourdomain.com", "http://16.171.22.172:3000"]
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://16.171.22.172:3000",
    ];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // This is crucial for session cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "Expires",
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Session configuration optimized for production and development
const sessionConfig = {
  secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false, // Changed to false to prevent empty sessions
  rolling: true, // Reset expiration on each request
  cookie: {
    secure: isProduction, // Use secure cookies in production (HTTPS only)
    httpOnly: true, // Security: prevent XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (increased from 24 hours)
    sameSite: isProduction ? "none" : "lax", // 'none' for cross-origin in production, 'lax' for localhost
    domain: isProduction ? process.env.COOKIE_DOMAIN : undefined, // Set domain in production
  },
  name: "demai.sid", // Custom session name
};

// Add session store for production (memory store is fine for development)
if (isProduction) {
  const MongoStore = (await import("connect-mongo")).default;
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600, // lazy session update
    ttl: 7 * 24 * 60 * 60, // 7 days
  });
}

app.use(session(sessionConfig));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(
    `-> [${timestamp}] ${req.method} ${req.originalUrl} from ${
      req.headers.origin || "unknown origin"
    }`
  );
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[API] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

connectDB();

app.use("/api/auth", authRoutes);
// app.use('/api/documents', documentRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/pricesheets", pricesheetRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/user", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/total-proposed-amount", totalProposedAmountRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Backend API is running!",
    cors: "CORS headers should be working",
    timestamp: new Date().toISOString(),
    endpoints: {
      // Auth endpoints
      signup: "POST /api/auth/signup",
      signin: "POST /api/auth/signin",
      signout: "POST /api/auth/signout",
      currentUser: "GET /api/auth/me",
      // Document endpoints
      uploadDocument: "POST /api/documents/upload",
      getDocuments: "GET /api/documents",
      getDocumentById: "GET /api/documents/:id",
      deleteDocument: "DELETE /api/documents/:id",
      // Bid endpoints
      createBid: "POST /api/bids",
      createBidWithDocument: "POST /api/bids/with-document",
      getBids: "GET /api/bids",
      getBidById: "GET /api/bids/:id",
      updateBid: "PUT /api/bids/:id",
      deleteBid: "DELETE /api/bids/:id",
      // Project endpoints
      createProject:
        "POST /api/projects (supports: projectName/title, clientName/client, projectType, location, projectDescription/description, estimatedStartDate/dueDate, budget, status)",
      getProjects: "GET /api/projects",
      getProjectById: "GET /api/projects/:id",
      updateProject: "PUT /api/projects/:id",
      deleteProject: "DELETE /api/projects/:id",
      getProjectStats: "GET /api/projects/stats",
      // Pricesheet endpoints
      createPricesheetItem:
        "POST /api/pricesheets (supports: name, price, description, category, unit)",
      getPricesheetItems: "GET /api/pricesheets",
      getAllPricesheetItems: "GET /api/pricesheets/all",
      getPricesheetItemById: "GET /api/pricesheets/:id",
      updatePricesheetItem: "PUT /api/pricesheets/:id",
      deletePricesheetItem: "DELETE /api/pricesheets/:id",
      // User endpoints
      getUserProfile: "GET /api/user/profile",
      updateAccountInfo:
        "PUT /api/user/account (supports: fullName, companyName, phone)",
      updateCompanyInfo:
        "PUT /api/user/company (supports: companyName, website, address)",
      updateNotifications:
        "PUT /api/user/notifications (supports: emailNotifications, bidUpdates, marketingCommunications)",
      updatePassword:
        "PUT /api/user/security (supports: currentPassword, newPassword, confirmPassword)",
      // Dashboard endpoints
      getDashboardData:
        "GET /api/dashboard/data (returns: totalRevenue, activeProjects, bidWinRate, etc.)",
      getDashboardCharts: "GET /api/dashboard/charts?period=year|month|week",
      // Total Proposed Amount endpoints
      getTotalProposedAmount: "GET /api/total-proposed-amount/:id",
      setTotalProposedAmount: "POST /api/total-proposed-amount/:id",
      updateTotalProposedAmount: "PUT /api/total-proposed-amount/:id",
      calculateTotalProposedAmount:
        "POST /api/total-proposed-amount/:id/calculate",
      clearTotalProposedAmount: "DELETE /api/total-proposed-amount/:id",
    },
  });
});

app.get("/test-cors", (req, res) => {
  res.json({
    message: "CORS test successful",
    origin: req.headers.origin,
    session: {
      exists: !!req.session,
      id: req.session?.id,
      userId: req.session?.userId,
    },
    cookies: req.headers.cookie,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/test-no-auth", (req, res) => {
  res.json({
    message: "API working without auth",
    session: {
      exists: !!req.session,
      id: req.session?.id,
      userId: req.session?.userId,
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
