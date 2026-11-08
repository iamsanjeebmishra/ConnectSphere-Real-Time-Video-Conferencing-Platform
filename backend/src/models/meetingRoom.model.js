
import mongoose, { Schema } from "mongoose";

const participantSchema = new Schema({
    socketId: {
        type: String,
        default: null
    },
    name: {
        type: String,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    guestToken: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ["host", "guest"],
        default: "guest"
    },
    status: {
        type: String,
        enum: ["waiting", "admitted", "rejected"],
        default: "waiting"
    },
    joinedAt: {
        type: Date,
        default: null
    },

    // MEETING RECONNECTION INFORMATION
    connectionStatus: {
        type: String,
        enum: ["connected", "disconnected"],
        default: "disconnected"
    },
    disconnectedAt: {
        type: Date,
        default: null
    },
    reconnectExpiresAt: {
        type: Date,
        default: null
    }

}, { _id: true });


const meetingRoomSchema = new Schema({
    meetingCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    host: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    accessType: {
        type: String,
        enum: ["open", "restricted"],
        default: "open"
    },
    status: {
        type: String,
        enum: ["active", "ended"],
        default: "active"
    },
    participants: [participantSchema]

}, {
    timestamps: true
});


const MeetingRoom = mongoose.model("MeetingRoom", meetingRoomSchema);

export { MeetingRoom };
