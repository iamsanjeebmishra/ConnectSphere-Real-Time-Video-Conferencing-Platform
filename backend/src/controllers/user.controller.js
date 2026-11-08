
import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";
import { MeetingRoom } from "../models/meetingRoom.model.js";

// GET AUTHENTICATED USER FROM SESSION
const getAuthenticatedUser = async (req) => {
    if (req.user?._id) {
        return req.user;
    }

    if (!req.session?.userId) {
        return null;
    }

    return await User.findById(req.session.userId);
};


// LOGIN
const login = async (req, res) => {
    const { username, password, rememberMe = false } = req.body;

    if (!username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Please provide username and password"
        });
    }

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Invalid username or password"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Invalid username or password"
            });
        }

        if (!req.session) {
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                message: "Session middleware is not configured"
            });
        }

        // Regenerate session ID to prevent session fixation.
        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Store authenticated user ID in the session.
        req.session.userId = user._id.toString();

        // Configure session cookie duration.
        const sessionDays = Number.parseInt(
            process.env.SESSION_MAX_AGE_DAYS || "7",
            10
        );

        const validSessionDays =
            Number.isFinite(sessionDays) && sessionDays > 0
                ? sessionDays
                : 7;

        if (rememberMe === true) {
            // Persistent cookie when Remember Me is selected.
            req.session.cookie.maxAge =
                validSessionDays * 24 * 60 * 60 * 1000;
        } else {
            // Browser-session cookie when Remember Me is not selected.
            req.session.cookie.maxAge = null;
        }

        // Ensure session is saved before responding.
        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        return res.status(httpStatus.OK).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to login"
        });
    }
};


// REGISTER
const register = async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Please provide name, username and password"
        });
    }

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username,
            password: hashedPassword
        });

        await newUser.save();

        return res.status(httpStatus.CREATED).json({
            message: "User Registered"
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to register user"
        });
    }
};


// CHECK CURRENT LOGIN SESSION
const getSession = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req);

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                authenticated: false,
                message: "Session expired or user not logged in"
            });
        }

        return res.status(httpStatus.OK).json({
            authenticated: true,
            user: {
                id: user._id,
                name: user.name,
                username: user.username
            }
        });

    } catch (error) {
        console.error("Session validation error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to validate session"
        });
    }
};


// LOGOUT
const logout = async (req, res) => {
    const cookieName = process.env.SESSION_COOKIE_NAME || "connect.sid";

    if (!req.session) {
        res.clearCookie(cookieName, { path: "/" });

        return res.status(httpStatus.OK).json({
            message: "Logged out successfully"
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
                message: "Unable to logout"
            });
        }

        res.clearCookie(cookieName, {
            path: "/"
        });

        return res.status(httpStatus.OK).json({
            message: "Logged out successfully"
        });
    });
};


// GET USER MEETING HISTORY
const getUserHistory = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req);

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Authentication required"
            });
        }

        const meetings = await Meeting.find({
            user_id: user.username
        }).sort({ date: -1 });

        return res.status(httpStatus.OK).json(meetings);

    } catch (error) {
        console.error("Fetch history error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to fetch meeting history"
        });
    }
};


// ADD MEETING TO USER HISTORY

const addToHistory = async (req, res) => {
    try {
        const { meeting_code } = req.body;

        if (typeof meeting_code !== "string" || !meeting_code.trim()) {
            return res.status(400).json({
                message: "Meeting code is required"
            });
        }

        const user = await getAuthenticatedUser(req);

        if (!user) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const meetingCode = meeting_code.trim();

        const filter = {
            user_id: user.username,
            meetingCode
        };

        try {
            await Meeting.updateOne(
                filter,
                {
                    $setOnInsert: {
                        user_id: user.username,
                        meetingCode,
                        date: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            // Handles simultaneous requests for the same meeting.
            if (error.code !== 11000) {
                throw error;
            }

            const existing = await Meeting.exists(filter);

            if (!existing) {
                throw error;
            }
        }

        return res.status(200).json({
            message: "Meeting history saved"
        });

    } catch (error) {
        console.error("Add history error:", error);

        return res.status(500).json({
            message: "Unable to save meeting history"
        });
    }
};


// DELETE USER ACCOUNT AND ASSOCIATED MEETING HISTORY
const deleteAccount = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req);

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Authentication required"
            });
        }

        // Delete all meeting-history records belonging to this user.
        await Meeting.deleteMany({
            user_id: user.username
        });

        // Delete the user account.
        await User.deleteOne({
            _id: user._id
        });

        // Destroy the current login session.
        const cookieName =
            process.env.SESSION_COOKIE_NAME || "connect.sid";

        if (req.session) {
            await new Promise((resolve) => {
                req.session.destroy((error) => {
                    if (error) {
                        console.error("Session destruction error:", error);
                    }
                    resolve();
                });
            });
        }

        res.clearCookie(cookieName, { path: "/" });

        return res.status(httpStatus.OK).json({
            message: "Account and meeting history deleted successfully"
        });

    } catch (error) {
        console.error("Delete account error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to delete account"
        });
    }
};


// CREATE MEETING
const createMeeting = async (req, res) => {
    try {
        const user = await getAuthenticatedUser(req);

        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Authentication required"
            });
        }

        const { accessType = "open" } = req.body;

        if (!["open", "restricted"].includes(accessType)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Invalid meeting access type"
            });
        }

        // Generate a unique meeting code.
        let meetingCode;
        let existingMeeting;

        do {
            meetingCode = crypto.randomBytes(4).toString("hex");
            existingMeeting = await MeetingRoom.findOne({ meetingCode });
        } while (existingMeeting);

        const meeting = await MeetingRoom.create({
            meetingCode,
            host: user._id,
            accessType,
            status: "active"
        });

        const clientUrl =
            process.env.CLIENT_URL || "http://localhost:3000";

        return res.status(httpStatus.CREATED).json({
            message: "Meeting created successfully",
            meetingCode: meeting.meetingCode,
            accessType: meeting.accessType,
            invitationLink: `${clientUrl}/${meeting.meetingCode}`
        });

    } catch (error) {
        console.error("Create meeting error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to create meeting"
        });
    }
};


export {
    login,
    register,
    getSession,
    logout,
    getUserHistory,
    addToHistory,
    createMeeting,
    deleteAccount
};