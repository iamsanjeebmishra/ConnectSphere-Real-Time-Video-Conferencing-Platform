
import httpStatus from "http-status";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { MeetingRoom } from "../models/meetingRoom.model.js";

// COMPARE GUEST RECOVERY TOKENS SAFELY
const isValidGuestToken = (storedToken, providedToken) => {
    if (
        typeof storedToken !== "string" ||
        typeof providedToken !== "string"
    ) {
        return false;
    }

    const storedBuffer = Buffer.from(storedToken);
    const providedBuffer = Buffer.from(providedToken);

    if (storedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(storedBuffer, providedBuffer);
};


// GUEST REQUESTS TO JOIN OR RESTORE A MEETING
const joinMeeting = async (req, res) => {
    try {
        const {
            meetingCode,
            name,
            participantId,
            guestToken
        } = req.body;

        if (
            typeof meetingCode !== "string" ||
            !meetingCode.trim()
        ) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Meeting code is required"
            });
        }

        const code = meetingCode.trim();

        const meeting = await MeetingRoom.findOne({
            meetingCode: code,
            status: "active"
        });

        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Meeting not found or has already ended"
            });
        }

        // RESTORE EXISTING GUEST IDENTITY
        // This prevents creating a duplicate participant during recovery.
        if (participantId || guestToken) {

            if (!participantId || !guestToken) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    message: "Participant ID and guest token are both required"
                });
            }

            if (!mongoose.Types.ObjectId.isValid(participantId)) {
                return res.status(httpStatus.BAD_REQUEST).json({
                    message: "Invalid participant ID"
                });
            }

            const participant =
                meeting.participants.id(participantId);

            if (
                !participant ||
                !isValidGuestToken(
                    participant.guestToken,
                    guestToken
                )
            ) {
                return res.status(httpStatus.UNAUTHORIZED).json({
                    message: "Invalid meeting recovery credentials"
                });
            }

            if (participant.status === "rejected") {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "Your request to join this meeting was rejected"
                });
            }

            if (
                !["admitted", "waiting"].includes(participant.status)
            ) {
                return res.status(httpStatus.FORBIDDEN).json({
                    message: "You cannot rejoin this meeting"
                });
            }

            // Check recovery deadline, if one was assigned.
            if (
                participant.reconnectExpiresAt &&
                new Date(participant.reconnectExpiresAt).getTime() <= Date.now()
            ) {
                return res.status(httpStatus.GONE).json({
                    message: "Your meeting recovery period has expired"
                });
            }

            return res.status(httpStatus.OK).json({
                message: participant.status === "admitted"
                    ? "Previous meeting identity restored"
                    : "Your previous request is still waiting for host approval",

                meetingCode: meeting.meetingCode,
                accessType: meeting.accessType,

                participantId: participant._id.toString(),
                guestToken: participant.guestToken,

                name: participant.name,
                status: participant.status,

                reconnected: true
            });
        }

        // FIRST-TIME GUEST JOIN
        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Guest name is required"
            });
        }

        const participantStatus =
            meeting.accessType === "open" ? "admitted" : "waiting";

        const newGuestToken = crypto.randomBytes(32).toString("hex");

        meeting.participants.push({
            name: name.trim(),
            role: "guest",
            status: participantStatus,
            guestToken: newGuestToken,
            socketId: null,
            joinedAt: participantStatus === "admitted"
                ? new Date()
                : null,
            connectionStatus: "disconnected",
            disconnectedAt: null,
            reconnectExpiresAt: null
        });

        const participant =
            meeting.participants[meeting.participants.length - 1];

        await meeting.save();

        // Notify connected host about restricted join requests.
        if (participantStatus === "waiting") {
            const io = req.app.get("io");

            if (io) {
                io.to(meeting.meetingCode).emit("guest-join-request", {
                    meetingCode: meeting.meetingCode,
                    participantId: participant._id.toString(),
                    name: participant.name,
                    status: participant.status
                });
            }
        }

        return res.status(httpStatus.OK).json({
            message: participantStatus === "admitted"
                ? "You can join the meeting"
                : "Your request has been sent to the host",

            meetingCode: meeting.meetingCode,
            accessType: meeting.accessType,

            participantId: participant._id.toString(),
            guestToken: newGuestToken,

            name: participant.name,
            status: participantStatus,

            reconnected: false
        });

    } catch (error) {
        console.error("Join meeting error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to process meeting request"
        });
    }
};


// VERIFY MEETING HOST
const verifyMeetingHost = async (meetingCode, userId) => {
    const meeting = await MeetingRoom.findOne({
        meetingCode,
        status: "active"
    });

    if (!meeting) {
        return {
            error: "Meeting not found or has ended",
            status: httpStatus.NOT_FOUND
        };
    }

    if (meeting.host.toString() !== userId.toString()) {
        return {
            error: "Only the meeting host can perform this action",
            status: httpStatus.FORBIDDEN
        };
    }

    return { meeting };
};


// GET WAITING PARTICIPANTS
const getWaitingParticipants = async (req, res) => {
    try {
        const { meetingCode } = req.params;

        const result = await verifyMeetingHost(
            meetingCode,
            req.user._id
        );

        if (result.error) {
            return res.status(result.status).json({
                message: result.error
            });
        }

        const waitingParticipants = result.meeting.participants
            .filter(participant => participant.status === "waiting")
            .map(participant => ({
                participantId: participant._id,
                name: participant.name,
                status: participant.status
            }));

        return res.status(httpStatus.OK).json({
            meetingCode,
            waitingParticipants
        });

    } catch (error) {
        console.error("Fetch waiting participants error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to fetch waiting participants"
        });
    }
};


// ADMIT PARTICIPANT
const admitParticipant = async (req, res) => {
    try {
        const { meetingCode, participantId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(participantId)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Invalid participant ID"
            });
        }

        const result = await verifyMeetingHost(
            meetingCode,
            req.user._id
        );

        if (result.error) {
            return res.status(result.status).json({
                message: result.error
            });
        }

        const participant =
            result.meeting.participants.id(participantId);

        if (!participant || participant.status !== "waiting") {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Waiting participant not found"
            });
        }

        participant.status = "admitted";
        participant.joinedAt = new Date();

        await result.meeting.save();

        // Notify the guest if their waiting socket is registered.
        const io = req.app.get("io");

        if (io && participant.socketId) {
            io.to(participant.socketId).emit("guest-admitted", {
                meetingCode,
                participantId: participant._id.toString(),
                status: "admitted"
            });
        }

        return res.status(httpStatus.OK).json({
            message: `${participant.name} has been admitted`,
            participantId: participant._id,
            status: participant.status
        });

    } catch (error) {
        console.error("Admit participant error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to admit participant"
        });
    }
};


// REJECT PARTICIPANT
const rejectParticipant = async (req, res) => {
    try {
        const { meetingCode, participantId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(participantId)) {
            return res.status(httpStatus.BAD_REQUEST).json({
                message: "Invalid participant ID"
            });
        }

        const result = await verifyMeetingHost(
            meetingCode,
            req.user._id
        );

        if (result.error) {
            return res.status(result.status).json({
                message: result.error
            });
        }

        const participant =
            result.meeting.participants.id(participantId);

        if (!participant || participant.status !== "waiting") {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "Waiting participant not found"
            });
        }

        participant.status = "rejected";

        await result.meeting.save();

        // Notify the rejected guest if their socket is registered.
        const io = req.app.get("io");

        if (io && participant.socketId) {
            io.to(participant.socketId).emit("guest-rejected", {
                meetingCode,
                participantId: participant._id.toString(),
                status: "rejected"
            });
        }

        return res.status(httpStatus.OK).json({
            message: `${participant.name} has been rejected`,
            participantId: participant._id,
            status: participant.status
        });

    } catch (error) {
        console.error("Reject participant error:", error);

        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Unable to reject participant"
        });
    }
};


export {
    joinMeeting,
    getWaitingParticipants,
    admitParticipant,
    rejectParticipant
};
