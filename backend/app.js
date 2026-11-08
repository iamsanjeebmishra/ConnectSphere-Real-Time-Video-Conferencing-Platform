
import "dotenv/config";

import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";

import { connectToSocket } from "./src/controllers/socketManager.js";
import userRoutes from "./src/routes/users.routes.js";

const app = express();

// Create HTTP and Socket.IO servers
const server = createServer(app);
const io = connectToSocket(server);

app.set("io", io);
app.set("port", process.env.PORT || 8000);

// Trust Render's reverse proxy in production
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
    app.set("trust proxy", 1);
}

// Allowed frontend origins
const allowedOrigins = (
    process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

// CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests without an Origin header, such as Postman.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// Express body parsing
app.use(express.json({ limit: "40kb" }));

app.use(express.urlencoded({
    limit: "40kb",
    extended: true
}));

// Start server and configure MongoDB sessions
const start = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        const sessionSecret = process.env.SESSION_SECRET;

        if (!mongoUri) {
            throw new Error("MONGODB_URI is missing from environment variables");
        }

        if (!sessionSecret) {
            throw new Error("SESSION_SECRET is missing from environment variables");
        }

        // Connect MongoDB
        const connectionDb = await mongoose.connect(mongoUri);

        console.log(
            `MongoDB connected to host: ${connectionDb.connection.host}`
        );

        // Maximum persistent login duration (default: 7 days)
        const sessionDays = Number(
            process.env.SESSION_MAX_AGE_DAYS || 7
        );

        if (!Number.isFinite(sessionDays) || sessionDays <= 0) {
            throw new Error("Invalid SESSION_MAX_AGE_DAYS configuration");
        }

        const sessionMaxAge = sessionDays * 24 * 60 * 60 * 1000;

        // Store sessions in MongoDB
        const sessionStore = MongoStore.create({
            mongoUrl: mongoUri,
            collectionName: "sessions",
            ttl: Math.floor(sessionMaxAge / 1000),
            autoRemove: "native"
        });

        // Express session middleware
        const sessionMiddleware = session({
            name: process.env.SESSION_COOKIE_NAME || "connect.sid",

            secret: sessionSecret,

            resave: false,
            saveUninitialized: false,

            store: sessionStore,

            cookie: {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? "none" : "lax",

                // No default persistent expiry.
                // The login controller sets maxAge only when
                // Remember Me is selected.
                path: "/"
            }
        });

        // Apply sessions to Express routes
        app.use(sessionMiddleware);

        // Share the same session with Socket.IO connections
        io.engine.use(sessionMiddleware);

        // User routes
        app.use("/api/v1/users", userRoutes);

        // Health check
        app.get("/", (req, res) => {
            res.status(200).json({
                message: "ConnectSphere backend is running"
            });
        });

        // Start HTTP server
        server.listen(app.get("port"), () => {
            console.log(
                `ConnectSphere server listening on port ${app.get("port")}`
            );

            console.log(
                `Maximum persistent login duration: ${sessionDays} days`
            );
        });

    } catch (error) {
        console.error("Server startup error:", error);
        process.exit(1);
    }
};

start();
