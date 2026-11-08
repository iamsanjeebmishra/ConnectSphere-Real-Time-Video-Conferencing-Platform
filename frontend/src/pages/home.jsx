
import React, { useContext, useState } from 'react';
import axios from 'axios';
import withAuth from '../utils/withAuth';
import { Link, useNavigate } from 'react-router-dom';
import "../App.css";

import {
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    RadioGroup,
    FormControlLabel,
    Radio,
    CircularProgress,
    Alert,
    IconButton
} from '@mui/material';

import HomeIcon from '@mui/icons-material/Home';
import RestoreIcon from '@mui/icons-material/Restore';
import LogoutIcon from '@mui/icons-material/Logout';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';

import { AuthContext } from '../contexts/AuthContext';
import server from '../environment';

function HomeComponent() {

    const navigate = useNavigate();

    const [meetingCode, setMeetingCode] = useState("");

    const {
        addToUserHistory,
        handleLogout: logout
    } = useContext(AuthContext);

    // CREATE MEETING STATES
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [accessType, setAccessType] = useState("open");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    // INVITATION STATES
    const [invitation, setInvitation] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // JOIN MEETING
    const handleJoinVideoCall = async () => {
        const enteredValue = meetingCode.trim();

        if (!enteredValue) return;

        try {
            let code = enteredValue;

            // Support both meeting codes and invitation URLs.
            if (enteredValue.includes("://")) {
                const url = new URL(enteredValue);
                code = url.pathname.split("/").filter(Boolean).pop();
            } else if (enteredValue.includes("/")) {
                code = enteredValue.split("/").filter(Boolean).pop();
            }

            if (!code) return;

            await addToUserHistory(code);

            navigate(`/${code}`);

        } catch (error) {
            console.error("Unable to join meeting:", error);

            alert(
                error.response?.data?.message ||
                "Unable to join meeting. Please check the meeting code."
            );
        }
    };

    // OPEN CREATE MEETING DIALOG
    const handleOpenCreateDialog = () => {
        setAccessType("open");
        setCreateError("");
        setInvitation(null);
        setCopySuccess(false);
        setOpenCreateDialog(true);
    };

    // CLOSE CREATE MEETING DIALOG
    const handleCloseCreateDialog = () => {
        if (creating) return;

        setOpenCreateDialog(false);
        setCreateError("");
    };

    // CREATE MEETING API
    const handleCreateMeeting = async () => {
        try {
            setCreating(true);
            setCreateError("");

            // Authenticate using the browser session cookie.
            const response = await axios.post(
                `${server}/api/v1/users/create_meeting`,
                {
                    accessType
                },
                {
                    withCredentials: true
                }
            );

            const data = response.data;

            const code = data.meetingCode;

            if (!code) {
                throw new Error("Meeting code was not returned by the server");
            }

            const invitationLink =
                data.invitationLink ||
                `${window.location.origin}/${code}`;

            setInvitation({
                meetingCode: code,
                invitationLink,
                accessType: data.accessType || accessType
            });

        } catch (error) {
            console.error("Create meeting error:", error);

            setCreateError(
                error.response?.data?.message ||
                error.message ||
                "Unable to create meeting. Please try again."
            );

        } finally {
            setCreating(false);
        }
    };

    // COPY INVITATION LINK
    const handleCopyInvitation = async () => {
        if (!invitation?.invitationLink) return;

        try {
            await navigator.clipboard.writeText(
                invitation.invitationLink
            );

            setCopySuccess(true);

        } catch (error) {
            console.error("Copy invitation error:", error);
            setCreateError("Unable to copy the invitation link.");
        }
    };

    // ENTER CREATED MEETING
    const handleEnterCreatedMeeting = () => {
        if (!invitation?.meetingCode) return;

        setOpenCreateDialog(false);
        navigate(`/${invitation.meetingCode}`);
    };

    // LOGOUT USING BROWSER SESSION
    const handleLogout = async () => {
        try {
            setLoggingOut(true);
            await logout();

        } catch (error) {
            console.error("Logout error:", error);

        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <div className="homePage">

            {/* NAVBAR */}
            <nav className="homeNavbar">

                {/* CLICKABLE BRAND LOGO - LANDING PAGE */}
                <Link
                    to="/"
                    className="homeBrand"
                    aria-label="Go to landing page"
                    style={{
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer"
                    }}
                >
                    <div
                        className="brandIcon"
                        style={{ backgroundColor: "#5A65E0" }}
                    >
                        <VideoCallIcon
                            sx={{
                                color: "#FFFFFF",
                                fontSize: 25
                            }}
                        />
                    </div>

                    <h2 style={{ color: "#192032" }}>
                        Connect<span style={{ color: "#5A65E0" }}>Sphere</span>
                    </h2>
                </Link>

                <div className="homeNavActions">

                    {/* HOME BUTTON - DASHBOARD */}
                    <Button
                        className="historyButton"
                        startIcon={<HomeIcon />}
                        onClick={() => navigate("/home")}
                    >
                        Home
                    </Button>

                    {/* HISTORY BUTTON */}
                    <Button
                        className="historyButton"
                        startIcon={<RestoreIcon />}
                        onClick={() => navigate("/history")}
                    >
                        History
                    </Button>

                    {/* LOGOUT BUTTON */}
                    <Button
                        className="logoutButton"
                        startIcon={<LogoutIcon />}
                        onClick={handleLogout}
                        disabled={loggingOut}
                    >
                        {loggingOut ? "Logging out..." : "Logout"}
                    </Button>

                </div>

            </nav>

            {/* MAIN DASHBOARD */}
            <main className="homeMain">

                <section className="welcomeSection">

                    <div className="welcomeContent">

                        <span className="welcomeTag">
                            YOUR SPACE TO CONNECT
                        </span>

                        <h1>
                            Video meetings.
                            <br />
                            <span>Made simple.</span>
                        </h1>

                        <p>
                            Connect with your friends, colleagues and loved ones
                            from anywhere. Start a conversation with just one click.
                        </p>

                        {/* JOIN MEETING */}
                        <div className="meetingInputSection">

                            <TextField
                                fullWidth
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                placeholder="Enter a meeting code or link"
                                variant="outlined"
                                className="meetingCodeInput"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleJoinVideoCall();
                                    }
                                }}
                            />

                            <Button
                                variant="contained"
                                className="joinMeetingButton"
                                onClick={handleJoinVideoCall}
                                disabled={!meetingCode.trim()}
                                endIcon={<ArrowForwardIcon />}
                            >
                                Join
                            </Button>

                        </div>

                        <div className="meetingHint">
                            <span className="hintDot"></span>
                            Your meetings are just one click away
                        </div>

                    </div>

                    {/* VIDEO MEETING ILLUSTRATION */}
                    <div className="welcomeIllustration">

                        <div className="meetingPreview">

                            <div className="previewHeader">
                                <div>
                                    <span className="liveDot"></span>
                                    <span>Live meeting</span>
                                </div>

                                <span className="previewTime">
                                    12:45
                                </span>
                            </div>

                            <div className="previewGrid">

                                <div className="previewPerson personOne">
                                    <div className="avatar avatarOne">S</div>
                                    <span>Sanjeeb</span>
                                    <div className="micStatus">🎙</div>
                                </div>

                                <div className="previewPerson personTwo">
                                    <div className="avatar avatarTwo">A</div>
                                    <span>Alex</span>
                                </div>

                                <div className="previewPerson personThree">
                                    <div className="avatar avatarThree">M</div>
                                    <span>Marie</span>
                                </div>

                                <div className="previewPerson personFour">
                                    <div className="avatar avatarFour">J</div>
                                    <span>John</span>
                                </div>

                            </div>

                            <div className="previewControls">
                                <span>🎙</span>
                                <span>📹</span>
                                <span className="endCall">☎</span>
                                <span>⋯</span>
                            </div>

                        </div>

                        {/* FLOATING INFORMATION CARD */}
                        <div className="floatingInfoCard">

                            <div className="floatingInfoIcon">
                                <VideoCallIcon />
                            </div>

                            <div>
                                <strong>Stay connected</strong>
                                <span>Anywhere, anytime</span>
                            </div>

                        </div>

                        {/* FLOATING PARTICIPANTS */}
                        <div className="floatingPeople">

                            <div className="miniAvatar miniOne">S</div>
                            <div className="miniAvatar miniTwo">A</div>
                            <div className="miniAvatar miniThree">P</div>

                            <span>+12 joined</span>

                        </div>

                    </div>

                </section>

                {/* QUICK ACTION CARDS */}
                <section className="quickActions">

                    <div className="quickActionHeading">
                        <h2>Get started</h2>
                        <p>Everything you need to connect with others.</p>
                    </div>

                    <div className="actionCards">

                        {/* CREATE MEETING */}
                        <div
                            className="actionCard createCard"
                            onClick={handleOpenCreateDialog}
                            style={{ cursor: "pointer" }}
                        >

                            <div className="actionIcon">
                                <VideoCallIcon />
                            </div>

                            <h3>Start a conversation</h3>

                            <p>
                                Create a meeting room and invite others
                                to join you.
                            </p>

                            <button
                                type="button"
                                onClick={handleOpenCreateDialog}
                            >
                                Create meeting
                                <ArrowForwardIcon />
                            </button>

                        </div>

                        {/* JOIN MEETING */}
                        <div className="actionCard joinCard">

                            <div className="actionIcon">
                                <ArrowForwardIcon />
                            </div>

                            <h3>Join a meeting</h3>

                            <p>
                                Have a meeting code? Enter it above
                                and join instantly.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    document.querySelector(
                                        ".meetingCodeInput input"
                                    )?.focus();
                                }}
                            >
                                Enter meeting code
                                <ArrowForwardIcon />
                            </button>

                        </div>

                        {/* MEETING HISTORY */}
                        <div
                            className="actionCard historyActionCard"
                            onClick={() => navigate("/history")}
                        >

                            <div className="actionIcon">
                                <RestoreIcon />
                            </div>

                            <h3>Meeting history</h3>

                            <p>
                                Revisit your previous meetings
                                whenever you need.
                            </p>

                            <button type="button">
                                View history
                                <ArrowForwardIcon />
                            </button>

                        </div>

                    </div>

                </section>

                <footer className="homeFooter">
                    <p>
                        © 2026 ConnectSphere. Connect beyond boundaries.
                    </p>
                </footer>

            </main>

            {/* CREATE MEETING DIALOG */}
            <Dialog
                open={openCreateDialog}
                onClose={handleCloseCreateDialog}
                fullWidth
                maxWidth="sm"
            >

                <DialogTitle
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                    }}
                >
                    {invitation ? "Your meeting is ready" : "Create a meeting"}

                    <IconButton
                        onClick={handleCloseCreateDialog}
                        disabled={creating}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers>

                    {!invitation ? (

                        <>
                            <p>
                                Choose how people can join your meeting.
                            </p>

                            <RadioGroup
                                value={accessType}
                                onChange={(e) => setAccessType(e.target.value)}
                            >

                                <FormControlLabel
                                    value="open"
                                    control={<Radio />}
                                    label={
                                        <div>
                                            <strong>Open meeting</strong>
                                            <div style={{ color: "#777" }}>
                                                Anyone with the invitation link
                                                can join directly.
                                            </div>
                                        </div>
                                    }
                                    sx={{ mb: 2 }}
                                />

                                <FormControlLabel
                                    value="restricted"
                                    control={<Radio />}
                                    label={
                                        <div>
                                            <strong>Restricted meeting</strong>
                                            <div style={{ color: "#777" }}>
                                                Guests must wait for your approval.
                                            </div>
                                        </div>
                                    }
                                />

                            </RadioGroup>

                            {createError && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {createError}
                                </Alert>
                            )}
                        </>

                    ) : (

                        <div>

                            <Alert severity="success" sx={{ mb: 2 }}>
                                Your meeting has been created successfully!
                            </Alert>

                            <p>
                                <strong>Meeting code</strong>
                            </p>

                            <div
                                style={{
                                    padding: "12px",
                                    background: "#f4f5fb",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    marginBottom: "18px",
                                    wordBreak: "break-all"
                                }}
                            >
                                {invitation.meetingCode}
                            </div>

                            <p>
                                <strong>Invitation link</strong>
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    alignItems: "center"
                                }}
                            >

                                <TextField
                                    fullWidth
                                    size="small"
                                    value={invitation.invitationLink}
                                    InputProps={{ readOnly: true }}
                                />

                                <Button
                                    variant="outlined"
                                    onClick={handleCopyInvitation}
                                    startIcon={<ContentCopyIcon />}
                                >
                                    Copy
                                </Button>

                            </div>

                            {copySuccess && (
                                <Alert severity="success" sx={{ mt: 2 }}>
                                    Invitation link copied!
                                </Alert>
                            )}

                            <p style={{ marginTop: "18px", color: "#777" }}>
                                Access type:{" "}
                                <strong>
                                    {invitation.accessType === "restricted"
                                        ? "Restricted"
                                        : "Open"}
                                </strong>
                            </p>

                        </div>

                    )}

                </DialogContent>

                <DialogActions sx={{ p: 2 }}>

                    {!invitation ? (

                        <>
                            <Button
                                onClick={handleCloseCreateDialog}
                                disabled={creating}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="contained"
                                onClick={handleCreateMeeting}
                                disabled={creating}
                            >
                                {creating ? (
                                    <>
                                        <CircularProgress
                                            size={18}
                                            color="inherit"
                                            sx={{ mr: 1 }}
                                        />
                                        Creating...
                                    </>
                                ) : (
                                    "Create meeting"
                                )}
                            </Button>
                        </>

                    ) : (

                        <Button
                            variant="contained"
                            onClick={handleEnterCreatedMeeting}
                            endIcon={<ArrowForwardIcon />}
                        >
                            Enter meeting
                        </Button>

                    )}

                </DialogActions>

            </Dialog>

        </div>
    );
}

export default withAuth(HomeComponent);
