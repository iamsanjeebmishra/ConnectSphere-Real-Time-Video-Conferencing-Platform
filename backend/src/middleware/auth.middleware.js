
import { User } from "../models/user.model.js";

const verifyToken = async (req, res, next) => {
    try {
        // Check whether a browser session exists.
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Find the authenticated user using the session ID.
        const user = await User.findById(req.session.userId);

        if (!user) {
            // Destroy invalid sessions.
            req.session.destroy(() => {});

            return res.status(401).json({
                message: "Invalid or expired session"
            });
        }

        // Attach authenticated user to request.
        req.user = user;

        next();

    } catch (error) {
        console.error("Session authentication error:", error);

        return res.status(500).json({
            message: "Authentication failed"
        });
    }
};

export default verifyToken;
