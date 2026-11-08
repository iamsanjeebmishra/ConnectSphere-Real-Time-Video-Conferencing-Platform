
import { Router } from "express";

import {
    addToHistory,
    getUserHistory,
    login,
    register,
    createMeeting,
    getSession,
    logout
} from "../controllers/user.controller.js";

import {
    joinMeeting,
    getWaitingParticipants,
    admitParticipant,
    rejectParticipant
} from "../controllers/meeting.controller.js";

import verifyToken from "../middleware/auth.middleware.js";

const router = Router();

// Authentication
router.route("/login").post(login);
router.route("/register").post(register);

// Browser session
router.route("/session").get(getSession);
router.route("/logout").post(logout);

// User meeting history (authenticated)
router.route("/add_to_activity")
    .post(verifyToken, addToHistory);

router.route("/get_all_activity")
    .get(verifyToken, getUserHistory);

// Create meeting (authenticated host)
router.route("/create_meeting")
    .post(verifyToken, createMeeting);

// Guest joining (no login required)
router.route("/join_meeting")
    .post(joinMeeting);

// Host-only participant management
router.route("/meeting/:meetingCode/requests")
    .get(verifyToken, getWaitingParticipants);

router.route("/meeting/:meetingCode/participants/:participantId/admit")
    .patch(verifyToken, admitParticipant);

router.route("/meeting/:meetingCode/participants/:participantId/reject")
    .patch(verifyToken, rejectParticipant);

export default router;
