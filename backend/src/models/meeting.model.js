
import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema({
    user_id: { type: String },
    meetingCode: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now, required: true }
});

// One history record per user per meeting code.
meetingSchema.index(
    { user_id: 1, meetingCode: 1 },
    {
        unique: true,
        partialFilterExpression: {
            user_id: { $type: "string" }
        },
        name: "unique_user_meeting_history"
    }
);

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };
