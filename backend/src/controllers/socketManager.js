import { Server } from "socket.io";
import { User } from "../models/user.model.js";
import { MeetingRoom } from "../models/meetingRoom.model.js";

let ioInstance;

const connections = {};
const messages = {};

const allowedOrigins = (
    process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

// Recovery window: 30 minutes by default.
const reconnectMinutes = Number(
    process.env.MEETING_RECONNECT_GRACE_MINUTES || 30
);

const RECONNECT_GRACE_MS =
    Number.isFinite(reconnectMinutes) && reconnectMinutes > 0
        ? reconnectMinutes * 60 * 1000
        : 30 * 60 * 1000;


export const getIO = () => {
    if (!ioInstance) {
        throw new Error("Socket.IO has not been initialized");
    }

    return ioInstance;
};


// REMOVE SOCKET FROM ACTIVE MEETING CONNECTIONS
const removeSocketFromRoom = (socket, io) => {
    const room = socket.data.meetingCode;

    if (!room || !connections[room]) {
        return;
    }

    connections[room] = connections[room].filter(
        id => id !== socket.id
    );

    socket.to(room).emit("user-left", socket.id);

    if (connections[room].length === 0) {
        delete connections[room];
    }

    socket.leave(room);
};


// MARK PARTICIPANT AS DISCONNECTED AND SET RECOVERY DEADLINE
const markParticipantDisconnected = async (socket) => {
    const meetingCode =
        socket.data.meetingCode ||
        socket.data.waitingMeetingCode;

    const participantId = socket.data.participantId;

    if (!meetingCode || !participantId) {
        return;
    }

    const now = new Date();

    const reconnectExpiresAt = new Date(
        now.getTime() + RECONNECT_GRACE_MS
    );

    try {
        await MeetingRoom.updateOne(
            {
                meetingCode,
                participants: {
                    $elemMatch: {
                        _id: participantId,
                        socketId: socket.id
                    }
                }
            },
            {
                $set: {
                    "participants.$.socketId": null,
                    "participants.$.connectionStatus": "disconnected",
                    "participants.$.disconnectedAt": now,
                    "participants.$.reconnectExpiresAt": reconnectExpiresAt
                }
            }
        );

    } catch (error) {
        console.error(
            "Participant recovery update error:",
            error
        );
    }
};


// VALIDATE MONGOOSE OBJECT ID
const mongooseIdIsValid = (id) => {
    return (
        typeof id === "string" &&
        /^[a-fA-F0-9]{24}$/.test(id)
    );
};


export const connectToSocket = (server) => {

    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type"],
            credentials: true
        }
    });

    ioInstance = io;


    io.on("connection", (socket) => {

        console.log("Socket connected:", socket.id);


        // =========================================
        // JOIN OR REJOIN MEETING
        // =========================================

        socket.on("join-call", async (payload) => {

            try {

                const {
                    meetingCode,
                    participantId,
                    guestToken,
                    mediaState: requestedMediaState
                } = payload || {};

                if (
                    typeof meetingCode !== "string" ||
                    !meetingCode.trim()
                ) {
                    return socket.emit("join-error", {
                        message: "Meeting code is required"
                    });
                }

                const code = meetingCode.trim();

                if (socket.data.meetingCode) {
                    return socket.emit("join-error", {
                        message: "Already connected to a meeting"
                    });
                }

                if (
                    socket.data.waitingMeetingCode &&
                    socket.data.waitingMeetingCode !== code
                ) {
                    return socket.emit("join-error", {
                        message: "Already waiting for another meeting"
                    });
                }

                const meeting = await MeetingRoom.findOne({
                    meetingCode: code,
                    status: "active"
                });

                if (!meeting) {
                    return socket.emit("join-error", {
                        message: "Meeting not found or has ended"
                    });
                }

                let participant = null;
                let role = null;
                let displayName = "";


                // =========================================
                // AUTHENTICATED HOST THROUGH EXPRESS SESSION
                // =========================================

                const sessionUserId = socket.request.session?.userId;

                if (sessionUserId) {

                    const user = await User.findById(sessionUserId)
                        .select("_id name username");

                    if (
                        user &&
                        meeting.host.toString() === user._id.toString()
                    ) {
                        role = "host";
                        displayName = user.name;
                    }
                }


                // =========================================
                // GUEST AUTHENTICATION AND RECOVERY
                // =========================================

                if (!role && participantId && guestToken) {

                    if (!mongooseIdIsValid(participantId)) {
                        return socket.emit("join-error", {
                            message: "Invalid participant ID"
                        });
                    }

                    participant = meeting.participants.id(participantId);

                    if (
                        !participant ||
                        participant.guestToken !== guestToken
                    ) {
                        return socket.emit("join-error", {
                            message: "Invalid guest credentials"
                        });
                    }

                    if (
                        socket.data.participantId &&
                        socket.data.participantId !==
                            participant._id.toString()
                    ) {
                        return socket.emit("join-error", {
                            message: "Invalid waiting session"
                        });
                    }

                    if (participant.status === "rejected") {
                        return socket.emit("guest-rejected", {
                            meetingCode: code,
                            participantId: participant._id.toString(),
                            status: "rejected"
                        });
                    }

                    // Do not allow recovery after the deadline.
                    if (
                        participant.reconnectExpiresAt &&
                        new Date(participant.reconnectExpiresAt).getTime() <= Date.now()
                    ) {
                        return socket.emit("join-error", {
                            message: "Your meeting recovery period has expired"
                        });
                    }

                    role = "guest";
                    displayName = participant.name;


                    // =========================================
                    // GUEST WAITING FOR HOST APPROVAL
                    // =========================================

                    if (participant.status === "waiting") {

                        // Replace an older waiting socket if necessary.
                        if (
                            participant.socketId &&
                            participant.socketId !== socket.id
                        ) {
                            const oldSocket =
                                io.sockets.sockets.get(participant.socketId);

                            if (oldSocket) {
                                oldSocket.data.superseded = true;
                                oldSocket.disconnect(true);
                            }
                        }

                        participant.socketId = socket.id;
                        participant.connectionStatus = "connected";
                        participant.disconnectedAt = null;
                        participant.reconnectExpiresAt = null;

                        await meeting.save();

                        socket.data.waitingMeetingCode = code;
                        socket.data.participantId =
                            participant._id.toString();
                        socket.data.role = "guest";
                        socket.data.displayName = displayName;

                        socket.emit("waiting-for-approval", {
                            meetingCode: code,
                            participantId: participant._id.toString(),
                            message: "Waiting for the host to admit you"
                        });

                        console.log(
                            `Guest ${displayName} is waiting in ${code}`
                        );

                        return;
                    }

                    if (participant.status !== "admitted") {
                        return socket.emit("join-error", {
                            message: "You cannot join this meeting"
                        });
                    }


                    // =========================================
                    // REPLACE OLD GUEST SOCKET
                    // =========================================

                    if (
                        participant.socketId &&
                        participant.socketId !== socket.id
                    ) {
                        const oldSocket =
                            io.sockets.sockets.get(participant.socketId);

                        if (oldSocket) {
                            oldSocket.data.superseded = true;
                            oldSocket.disconnect(true);
                        }
                    }

                }


                // =========================================
                // CHECK VALID HOST OR GUEST
                // =========================================

                if (!role) {
                    return socket.emit("join-error", {
                        message: "Meeting authentication required"
                    });
                }


                // =========================================
                // REGISTER PARTICIPANT CONNECTION
                // =========================================

                if (participant) {

                    participant.socketId = socket.id;
                    participant.connectionStatus = "connected";
                    participant.disconnectedAt = null;
                    participant.reconnectExpiresAt = null;

                    await meeting.save();
                }

                await socket.join(code);

                if (!connections[code]) {
                    connections[code] = [];
                }

                if (!connections[code].includes(socket.id)) {
                    connections[code].push(socket.id);
                }

                socket.data.waitingMeetingCode = null;
                socket.data.meetingCode = code;
                socket.data.role = role;
                socket.data.displayName = displayName;
                socket.data.participantId =
                    participant?._id?.toString() || null;

                // Media state is display metadata supplied by this participant.
                // Default to enabled for older clients that do not send it yet.
                socket.data.mediaState = {
                    audioEnabled: typeof requestedMediaState?.audioEnabled === "boolean"
                        ? requestedMediaState.audioEnabled
                        : true,
                    videoEnabled: typeof requestedMediaState?.videoEnabled === "boolean"
                        ? requestedMediaState.videoEnabled
                        : true,
                    screenSharing: requestedMediaState?.screenSharing === true
                };


                // =========================================
                // VERIFIED PARTICIPANT DETAILS
                // =========================================

                const participantDetails = {};

                connections[code].forEach((id) => {

                    const connectedSocket =
                        io.sockets.sockets.get(id);

                    if (connectedSocket) {

                        participantDetails[id] = {
                            name: connectedSocket.data.displayName,
                            role: connectedSocket.data.role,
                            audioEnabled:
                                connectedSocket.data.mediaState?.audioEnabled !== false,
                            videoEnabled:
                                connectedSocket.data.mediaState?.videoEnabled !== false,
                            screenSharing:
                                connectedSocket.data.mediaState?.screenSharing === true
                        };
                    }
                });

                const clients = [...connections[code]];


                // NOTIFY EVERYONE ABOUT UPDATED PARTICIPANTS

                clients.forEach((id) => {

                    io.to(id).emit(
                        "user-joined",
                        socket.id,
                        clients,
                        participantDetails
                    );
                });


                // =========================================
                // RESTORE PREVIOUS CHAT MESSAGES
                // =========================================

                if (messages[code]) {

                    messages[code].forEach((item) => {

                        socket.emit(
                            "chat-message",
                            item.data,
                            item.sender,
                            item.socketId,
                            item.role
                        );
                    });
                }


                // =========================================
                // JOIN SUCCESS
                // =========================================

                socket.emit("join-success", {
                    meetingCode: code,
                    role,
                    name: displayName,
                    participantId:
                        participant?._id?.toString() || null,
                    reconnected: Boolean(
                        participant?.joinedAt
                    )
                });

                console.log(
                    `${displayName} (${role}) joined meeting: ${code}`
                );

            } catch (error) {

                console.error("Join meeting error:", error);

                socket.emit("join-error", {
                    message: "Unable to join meeting"
                });
            }

        });


        // =========================================
        // INTENTIONAL LEAVE MEETING
        // =========================================

        socket.on("leave-meeting", async () => {

            try {

                const room = socket.data.meetingCode;
                const waitingRoom = socket.data.waitingMeetingCode;

                if (!room && !waitingRoom) {
                    return socket.emit("meeting-left", {
                        success: true
                    });
                }

                // Notify other participants.
                removeSocketFromRoom(socket, io);

                // Preserve guest identity for the recovery window.
                await markParticipantDisconnected(socket);

                socket.data.intentionalLeave = true;

                socket.data.meetingCode = null;
                socket.data.waitingMeetingCode = null;
                socket.data.participantId = null;
                socket.data.role = null;
                socket.data.displayName = null;

                socket.emit("meeting-left", {
                    success: true,
                    meetingCode: room || waitingRoom,
                    message: "You have left the meeting"
                });

                console.log(
                    `Socket ${socket.id} intentionally left meeting`
                );

            } catch (error) {

                console.error("Leave meeting error:", error);

                socket.emit("meeting-left", {
                    success: false,
                    message: "Unable to leave meeting cleanly"
                });
            }

        });


        // =========================================
        // WEBRTC SIGNALING
        // =========================================

        socket.on("signal", (toId, message) => {

            const room = socket.data.meetingCode;

            if (
                !room ||
                !connections[room]?.includes(socket.id) ||
                !connections[room]?.includes(toId)
            ) {
                return;
            }

            io.to(toId).emit(
                "signal",
                socket.id,
                message
            );

        });


        // =========================================
        // PARTICIPANT MEDIA STATE (CAMERA / MICROPHONE)
        // =========================================

        socket.on("media-state", (state = {}) => {
            const room = socket.data.meetingCode;

            if (
                !room ||
                !connections[room]?.includes(socket.id) ||
                typeof state.audioEnabled !== "boolean" ||
                typeof state.videoEnabled !== "boolean" ||
                typeof state.screenSharing !== "boolean"
            ) {
                return;
            }

            const mediaState = {
                audioEnabled: state.audioEnabled,
                videoEnabled: state.videoEnabled,
                screenSharing: state.screenSharing
            };

            socket.data.mediaState = mediaState;

            // Exclude the sender; its own controls already reflect this state.
            socket.to(room).emit("media-state", {
                socketId: socket.id,
                ...mediaState
            });
        });


        // =========================================
        // CHAT
        // =========================================

        socket.on("chat-message", (data) => {

            const room = socket.data.meetingCode;

            if (
                !room ||
                !connections[room]?.includes(socket.id) ||
                typeof data !== "string" ||
                !data.trim()
            ) {
                return;
            }

            const chatText = data.trim().slice(0, 2000);

            // Sender identity comes from verified socket data.
            const sender = socket.data.displayName || "Participant";
            const role = socket.data.role || "guest";

            if (!messages[room]) {
                messages[room] = [];
            }

            const chatMessage = {
                data: chatText,
                sender,
                role,
                socketId: socket.id
            };

            messages[room].push(chatMessage);

            io.to(room).emit(
                "chat-message",
                chatText,
                sender,
                socket.id,
                role
            );

            console.log(
                `Message in ${room} from ${sender} (${role}):`,
                chatText
            );

        });


        // =========================================
        // SOCKET DISCONNECT
        // =========================================

        socket.on("disconnect", async (reason) => {

            const room = socket.data.meetingCode;
            const waitingRoom = socket.data.waitingMeetingCode;

            // Old socket replaced by a newer connection.
            if (socket.data.superseded) {
                console.log(
                    "Previous participant socket replaced:",
                    socket.id
                );

                return;
            }

            // REMOVE FROM ACTIVE MEETING
            if (room && connections[room]) {

                connections[room] = connections[room].filter(
                    id => id !== socket.id
                );

                socket.to(room).emit("user-left", socket.id);

                if (connections[room].length === 0) {
                    delete connections[room];
                }
            }

            // MARK GUEST AS TEMPORARILY DISCONNECTED.
            // The participant and guest token remain in MongoDB.
            if (socket.data.participantId) {
                await markParticipantDisconnected(socket);
            }

            console.log(
                `Socket disconnected: ${socket.id}. Reason: ${reason}`
            );

        });

    });


    return io;
};