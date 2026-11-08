
import '../styles/history.css';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import withAuth from '../utils/withAuth';
import { Link, useNavigate } from 'react-router-dom';

import {
    Button,
    IconButton,
    TextField,
    InputAdornment,
    CircularProgress
} from '@mui/material';

import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import HistoryIcon from '@mui/icons-material/History';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';

function History() {

    const { getHistoryOfUser } = useContext(AuthContext);

    const [meetings, setMeetings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const routeTo = useNavigate();

    // FETCH USER MEETING HISTORY
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                setError('');

                const history = await getHistoryOfUser();

                setMeetings(Array.isArray(history) ? history : []);

            } catch (error) {
                console.error('Unable to fetch meeting history:', error);

                setError(
                    error.response?.data?.message ||
                    'Unable to load your meeting history. Please try again.'
                );

            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [getHistoryOfUser]);

    // FORMAT DATE
    const formatDate = (dateString) => {
        if (!dateString) return 'Date unavailable';

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return 'Date unavailable';
        }

        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // FORMAT TIME
    const formatTime = (dateString) => {
        if (!dateString) return '';

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // SEARCH MEETING HISTORY
    const filteredMeetings = useMemo(() => {
        return meetings.filter((meeting) =>
            (meeting.meetingCode || '')
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase())
        );
    }, [meetings, searchQuery]);

    // COPY MEETING CODE
    const handleCopy = async (meetingCode) => {
        if (!meetingCode) return;

        try {
            await navigator.clipboard.writeText(meetingCode);
        } catch (error) {
            console.error('Unable to copy meeting code:', error);
        }
    };

    // JOIN PREVIOUS MEETING
    const handleJoinMeeting = (meetingCode) => {
        if (meetingCode) {
            routeTo(`/${meetingCode}`);
        }
    };

    return (
        <div className="historyPage">

            {/* NAVBAR */}

            <nav className="historyNavbar">

                {/* CLICKABLE CONNECTSPHERE LOGO - LANDING PAGE */}
                <Link
                    to="/"
                    className="historyBrand"
                    aria-label="Go to landing page"
                    style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer'
                    }}
                >
                    <div
                        className="historyBrandIcon"
                        style={{ backgroundColor: "#5A65E0" }}
                    >
                        <svg
                            viewBox="0 0 48 48"
                            width="25"
                            height="25"
                            role="img"
                            aria-label="ConnectSphere video camera logo"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* White video camera body */}
                            <rect
                                x="4"
                                y="12"
                                width="29"
                                height="24"
                                rx="3"
                                fill="#FFFFFF"
                            />

                            {/* Camera lens */}
                            <path
                                d="M33 19 L44 11 V37 L33 29 Z"
                                fill="#FFFFFF"
                            />

                            {/* Plus symbol cut into the camera body */}
                            <path
                                d="M18.5 17 V31 M11.5 24 H25.5"
                                stroke="#5A65E0"
                                strokeWidth="4.5"
                                strokeLinecap="butt"
                            />
                        </svg>
                    </div>

                    <h2 style={{ color: "#192032" }}>
                        Connect<span style={{ color: "#5A65E0" }}>Sphere</span>
                    </h2>
                </Link>

                {/* HOME BUTTON - DASHBOARD */}
                <Button
                    className="historyHomeButton"
                    startIcon={<HomeIcon />}
                    onClick={() => routeTo('/home')}
                >
                    Home
                </Button>

            </nav>


            {/* MAIN CONTENT */}

            <main className="historyMain">

                <div className="historyHeading">

                    <div>
                        <div className="historyEyebrow">
                            <HistoryIcon />
                            YOUR ACTIVITY
                        </div>

                        <h1>Meeting History</h1>

                        <p>
                            Keep track of your previous meetings and
                            reconnect whenever you need.
                        </p>
                    </div>

                    <div className="historyHeadingIcon">
                        <VideoCallIcon />
                    </div>

                </div>


                {/* SEARCH AND COUNT */}

                <section className="historyToolbar">

                    <TextField
                        className="historySearch"
                        fullWidth
                        placeholder="Search by meeting code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        variant="outlined"
                        size="small"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }}
                    />

                    <div className="historyCount">
                        <span>{meetings.length}</span>
                        <p>Total meetings</p>
                    </div>

                </section>


                {/* LOADING STATE */}

                {loading && (
                    <div className="historyStatus">
                        <CircularProgress />
                        <p>Loading your meeting history...</p>
                    </div>
                )}


                {/* ERROR STATE */}

                {!loading && error && (
                    <div className="historyStatus historyError">
                        <p>{error}</p>

                        <Button
                            variant="contained"
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </Button>
                    </div>
                )}


                {/* MEETING LIST */}

                {!loading && !error && filteredMeetings.length > 0 && (

                    <section className="historyList">

                        <div className="historyListHeader">
                            <h2>Previous meetings</h2>
                            <span>
                                {filteredMeetings.length} found
                            </span>
                        </div>

                        {filteredMeetings.map((meeting, index) => (

                            <article
                                className="historyCard"
                                key={meeting._id || meeting.meetingCode || index}
                            >

                                <div className="historyCardIcon">
                                    <VideocamOutlinedIcon />
                                </div>

                                <div className="historyCardDetails">

                                    <h3>
                                        Meeting
                                    </h3>

                                    <div className="historyMeetingCode">
                                        <span>Meeting ID:</span>

                                        <strong>
                                            {meeting.meetingCode}
                                        </strong>

                                        <IconButton
                                            size="small"
                                            onClick={() => handleCopy(meeting.meetingCode)}
                                            title="Copy meeting ID"
                                            aria-label="Copy meeting ID"
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </div>

                                    <div className="historyDate">
                                        <CalendarMonthIcon />

                                        <span>
                                            {formatDate(meeting.date)}
                                        </span>

                                        {formatTime(meeting.date) && (
                                            <>
                                                <span className="historyDateSeparator">
                                                    •
                                                </span>

                                                <span>
                                                    {formatTime(meeting.date)}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                </div>

                                <Button
                                    className="historyJoinButton"
                                    variant="contained"
                                    onClick={() => handleJoinMeeting(meeting.meetingCode)}
                                    endIcon={<VideoCallIcon />}
                                    disabled={!meeting.meetingCode}
                                >
                                    Rejoin
                                </Button>

                            </article>

                        ))}

                    </section>

                )}


                {/* EMPTY STATE */}

                {!loading && !error && filteredMeetings.length === 0 && (

                    <div className="historyEmptyState">

                        <div className="historyEmptyIcon">
                            <HistoryIcon />
                        </div>

                        <h2>
                            {searchQuery
                                ? 'No matching meetings'
                                : 'No meeting history yet'}
                        </h2>

                        <p>
                            {searchQuery
                                ? 'Try searching with a different meeting code.'
                                : 'Your previous meetings will appear here once you start connecting.'}
                        </p>

                        {searchQuery ? (
                            <Button
                                variant="outlined"
                                onClick={() => setSearchQuery('')}
                            >
                                Clear search
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={() => routeTo('/home')}
                                startIcon={<VideoCallIcon />}
                            >
                                Start a meeting
                            </Button>
                        )}

                    </div>

                )}

            </main>


            {/* FOOTER */}

            <footer className="historyFooter">
                <span>© ConnectSphere</span>
                <span>Connect. Collaborate. Communicate.</span>
            </footer>

        </div>
    );
}

export default withAuth(History);
