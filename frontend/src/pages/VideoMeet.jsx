
import React, { useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

import { Badge, IconButton, TextField, Button } from '@mui/material';

import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VideoCallIcon from '@mui/icons-material/VideoCall';

import styles from '../styles/videoComponent.module.css';
import server from '../environment';
import { AuthContext } from '../contexts/AuthContext';

const server_url = server;

// Reuse the same MUI VideoCall logo used in the Home navbar.
function ConnectSphereLogoMark() {
    return (
        <VideoCallIcon
            style={{
                color: "#FFFFFF",
                width: "68%",
                height: "68%"
            }}
        />
    );
}

var connections = {};

const peerConfigConnections = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

export default function VideoMeetComponent() {

    const { userData } = useContext(AuthContext);

    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoref = useRef();
    const videoRef = useRef([]);

    // Keep camera capture separate from the display stream. The camera stays
    // alive during screen sharing so it can be restored without reacquiring it.
    const cameraStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const screenShareRequestRef = useRef(0);

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);

    const [video, setVideo] = useState([]);
    const [audio, setAudio] = useState();

    const [screen, setScreen] = useState();
    const [screenAvailable, setScreenAvailable] = useState();

    // Chat is closed by default.
    const [showModal, setModal] = useState(false);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [newMessages, setNewMessages] = useState(0);

    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState('');
    const [waitingForApproval, setWaitingForApproval] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinRequests, setJoinRequests] = useState([]);
    const [isHost, setIsHost] = useState(false);

    const guestCredentialsRef = useRef(null);
    const guestJoinAttemptedRef = useRef(false);
    const socketHandlersAttachedRef = useRef(false);
    const intentionalLeaveRef = useRef(false);

    const [hasLeftMeeting, setHasLeftMeeting] = useState(false);
    const [hasRecoverySession, setHasRecoverySession] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    const [videos, setVideos] = useState([]);
    const [participants, setParticipants] = useState({});
    const participantsRef = useRef({});
    const [localRole, setLocalRole] = useState('');

    // View selection is local to this browser. It does not affect other participants.
    // Two-person meetings open in focus mode; larger meetings open in grid mode.
    const [meetingViewMode, setMeetingViewMode] = useState('auto');
    const [selectedParticipantId, setSelectedParticipantId] = useState(null);

    // Guest recovery credentials are separate from the login session.
    // They are scoped to this meeting and validated by the backend.
    const getRecoveryStorageKey = () =>
        `connectsphere:meeting-recovery:${getMeetingCode()}`;

    const readGuestRecovery = () => {
        try {
            const stored = localStorage.getItem(getRecoveryStorageKey());

            if (!stored) return null;

            const credentials = JSON.parse(stored);

            if (
                !credentials?.participantId ||
                !credentials?.guestToken ||
                credentials.meetingCode !== getMeetingCode()
            ) {
                localStorage.removeItem(getRecoveryStorageKey());
                return null;
            }

            return credentials;

        } catch (error) {
            console.error(
                'Unable to read meeting recovery information:',
                error
            );

            return null;
        }
    };

    const saveGuestRecovery = (credentials) => {
        if (
            !credentials?.participantId ||
            !credentials?.guestToken
        ) return;

        try {
            localStorage.setItem(
                getRecoveryStorageKey(),
                JSON.stringify(credentials)
            );
        } catch (error) {
            console.error(
                'Unable to save meeting recovery information:',
                error
            );
        }
    };

    const clearGuestRecovery = () => {
        try {
            localStorage.removeItem(getRecoveryStorageKey());
        } catch (error) {
            console.error(
                'Unable to clear meeting recovery information:',
                error
            );
        }

        guestCredentialsRef.current = null;
        setHasRecoverySession(false);
    };

    // Restore a guest identity after refresh or accidental tab closure.
    useEffect(() => {
        const savedCredentials = readGuestRecovery();

        if (savedCredentials) {
            guestCredentialsRef.current = savedCredentials;
            guestJoinAttemptedRef.current = true;

            setUsername(savedCredentials.name || '');
            setHasRecoverySession(true);

        } else if (userData?.name) {
            setUsername(current => current || userData.name);
        }

    }, [userData]);

    // Keep one sender per media kind. replaceTrack switches between camera
    // and screen video without renegotiating the peer connection.
    const attachStreamToPeer = async (peer, stream) => {
        if (!peer || !stream) return false;

        let addedTrack = false;
        const streamTracks = stream.getTracks();

        for (const kind of ['video', 'audio']) {
            const nextTrack = streamTracks.find(track => track.kind === kind) || null;
            const existingSender = peer.getSenders().find(sender =>
                sender.track?.kind === kind
            ) || peer.getTransceivers()
                .find(transceiver => transceiver.receiver?.track?.kind === kind)
                ?.sender;

            if (existingSender) {
                if (existingSender.track !== nextTrack) {
                    try {
                        await existingSender.replaceTrack(nextTrack);
                    } catch (error) {
                        console.error(`Unable to replace WebRTC ${kind} track:`, error);
                    }
                }
            } else if (nextTrack) {
                peer.addTrack(nextTrack, stream);
                addedTrack = true;
            }
        }

        return addedTrack;
    };

    const sendPeerOffer = async (peerId) => {
        const peer = connections[peerId];
        if (!peer || !socketRef.current || peer.signalingState !== 'stable') return;

        try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socketRef.current.emit(
                'signal',
                peerId,
                JSON.stringify({ sdp: peer.localDescription })
            );
        } catch (error) {
            console.error('Unable to renegotiate media tracks:', error);
        }
    };

    const getLiveTrack = (stream, kind) =>
        stream?.getTracks().find(track =>
            track.kind === kind && track.readyState === 'live'
        ) || null;

    const buildOutgoingStream = () => {
        const screenVideoTrack = getLiveTrack(screenStreamRef.current, 'video');
        const cameraVideoTrack = getLiveTrack(cameraStreamRef.current, 'video');
        const microphoneTrack = getLiveTrack(cameraStreamRef.current, 'audio');
        const outgoingTracks = [];

        // Send the shared display to guests, but keep the host's local tile on
        // the camera feed. This prevents the meeting preview from capturing
        // itself when the current window/monitor is shared.
        const outgoingVideoTrack = screenVideoTrack || cameraVideoTrack;
        if (outgoingVideoTrack) outgoingTracks.push(outgoingVideoTrack);
        if (microphoneTrack) outgoingTracks.push(microphoneTrack);

        return new MediaStream(outgoingTracks);
    };

    const syncOutgoingStream = async () => {
        const outgoingStream = buildOutgoingStream();
        window.localStream = outgoingStream;

        // Local preview always remains the camera, never the screen-share feed.
        if (localVideoref.current) {
            const previewStream = cameraStreamRef.current || new MediaStream();
            if (localVideoref.current.srcObject !== previewStream) {
                localVideoref.current.srcObject = previewStream;
            }
            localVideoref.current.play?.().catch(() => {});
        }

        const peerIds = Object.keys(connections).filter(
            peerId => peerId !== socketIdRef.current
        );

        await Promise.all(peerIds.map(async peerId => {
            const peer = connections[peerId];
            const addedTrack = await attachStreamToPeer(peer, outgoingStream);
            if (addedTrack) await sendPeerOffer(peerId);
        }));

        return outgoingStream;
    };

    const updateCameraStream = async (stream) => {
        const previousStream = cameraStreamRef.current;
        cameraStreamRef.current = stream;

        if (stream) {
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    const currentStream = cameraStreamRef.current;
                    if (!currentStream?.getTracks().includes(track)) return;

                    const remainingTracks = currentStream.getTracks().filter(item =>
                        item !== track && item.readyState === 'live'
                    );
                    cameraStreamRef.current = remainingTracks.length
                        ? new MediaStream(remainingTracks)
                        : null;

                    if (track.kind === 'video') setVideo(false);
                    if (track.kind === 'audio') setAudio(false);

                    syncOutgoingStream();
                };
            });
        }

        await syncOutgoingStream();

        // Stop old camera tracks only after peers have switched to the new ones.
        if (previousStream && previousStream !== stream) {
            previousStream.getTracks().forEach(track => {
                track.onended = null;
                if (track.readyState !== 'ended') track.stop();
            });
        }
    };

    const stopScreenSharing = async () => {
        // Invalidate a display permission prompt that is still pending.
        screenShareRequestRef.current += 1;

        const activeScreenStream = screenStreamRef.current;
        screenStreamRef.current = null;

        if (activeScreenStream) {
            activeScreenStream.getTracks().forEach(track => {
                track.onended = null;
                if (track.readyState !== 'ended') track.stop();
            });
        }

        setScreen(false);
        await syncOutgoingStream();
    };

    // Clean up media and socket resources when leaving the meeting page.
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }

            Object.values(connections).forEach(connection => {
                connection.close();
            });

            connections = {};

            stopLocalMedia();
        };
    }, []);

    // Request camera and microphone permissions.
    useEffect(() => {
        getPermissions();
    }, []);

    const stopLocalMedia = () => {
        try {
            screenShareRequestRef.current += 1;

            const streams = [
                cameraStreamRef.current,
                screenStreamRef.current,
                window.localStream
            ].filter(Boolean);
            const tracks = new Set(
                streams.flatMap(stream => stream.getTracks())
            );

            cameraStreamRef.current = null;
            screenStreamRef.current = null;
            window.localStream = null;

            tracks.forEach(track => {
                track.onended = null;
                if (track.readyState !== 'ended') track.stop();
            });

            if (localVideoref.current) {
                localVideoref.current.srcObject = null;
            }
        } catch (error) {
            console.error('Unable to stop local media:', error);
        }
    };

    const closePeerConnections = () => {
        Object.values(connections).forEach(connection => {
            try {
                connection.close();
            } catch (error) {
                console.error(
                    'Unable to close peer connection:',
                    error
                );
            }
        });

        connections = {};

        setVideos([]);
        videoRef.current = [];

        participantsRef.current = {};
        setParticipants({});
    };

    const showLeftMeetingScreen = () => {
        setWaitingForApproval(false);
        setAskForUsername(false);
        setHasLeftMeeting(true);
        setConnectionStatus('disconnected');
        setModal(false);

        stopLocalMedia();
        closePeerConnections();
    };

    const handleRejoinMeeting = () => {
        intentionalLeaveRef.current = false;

        guestJoinAttemptedRef.current =
            Boolean(guestCredentialsRef.current);

        socketHandlersAttachedRef.current = false;

        setJoinError('');
        setHasLeftMeeting(false);
        setAskForUsername(false);
        setWaitingForApproval(false);
        setConnectionStatus('connecting');

        closePeerConnections();
        getMedia();
    };

    const handleReturnHome = () => {
        stopLocalMedia();

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        window.location.href = '/';
    };

    const getPermissions = async () => {
        let canUseVideo = false;
        let canUseAudio = false;

        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({
                video: true
            });
            canUseVideo = Boolean(videoPermission);
            videoPermission.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.log('Camera permission unavailable:', error);
        }

        try {
            const audioPermission = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
            canUseAudio = Boolean(audioPermission);
            audioPermission.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.log('Microphone permission unavailable:', error);
        }

        setVideoAvailable(canUseVideo);
        setAudioAvailable(canUseAudio);
        setScreenAvailable(Boolean(navigator.mediaDevices.getDisplayMedia));

        if (!canUseVideo && !canUseAudio) return;

        try {
            const userMediaStream = await navigator.mediaDevices.getUserMedia({
                video: canUseVideo,
                audio: canUseAudio
            });
            await updateCameraStream(userMediaStream);
        } catch (error) {
            console.error('Unable to access camera/microphone:', error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();

            console.log('SET STATE HAS', video, audio);
        }
    }, [video, audio]);

    const getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);

        connectToSocketServer();
    };

    const getUserMediaSuccess = async (stream) => {
        await updateCameraStream(stream);
    };

    const getUserMedia = async () => {
        const constraints = {
            video: Boolean(video && videoAvailable),
            audio: Boolean(audio && audioAvailable)
        };

        if (!constraints.video && !constraints.audio) {
            await updateCameraStream(null);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            await getUserMediaSuccess(stream);
        } catch (error) {
            console.error('Unable to update camera/microphone:', error);
        }
    };

    const getDislayMedia = async () => {
        if (!navigator.mediaDevices.getDisplayMedia) return;

        const requestId = ++screenShareRequestRef.current;

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 15, max: 30 }
                },
                audio: false,
                // Ask supporting browsers not to offer the current meeting tab.
                // Safari may ignore these hints, so the local preview is also
                // kept on the camera feed to prevent a recursive mirror effect.
                selfBrowserSurface: 'exclude',
                preferCurrentTab: false,
                systemAudio: 'exclude'
            });

            if (requestId !== screenShareRequestRef.current) {
                displayStream.getTracks().forEach(track => track.stop());
                return;
            }

            await getDislayMediaSuccess(displayStream);
        } catch (error) {
            console.error('Unable to start screen sharing:', error);
            if (requestId === screenShareRequestRef.current) {
                setScreen(false);
            }
        }
    };

    const getDislayMediaSuccess = async (stream) => {
        const displayVideoTrack = stream.getVideoTracks()[0];

        if (!displayVideoTrack) {
            stream.getTracks().forEach(track => track.stop());
            setScreen(false);
            return;
        }

        const previousScreenStream = screenStreamRef.current;
        screenStreamRef.current = stream;

        displayVideoTrack.onended = () => {
            if (screenStreamRef.current === stream) {
                stopScreenSharing();
            }
        };

        await syncOutgoingStream();

        if (previousScreenStream && previousScreenStream !== stream) {
            previousScreenStream.getTracks().forEach(track => {
                track.onended = null;
                if (track.readyState !== 'ended') track.stop();
            });
        }

        console.log('Screen sharing started');
    };

    const gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message);

        if (fromId !== socketIdRef.current) {

            if (signal.sdp) {
                connections[fromId]
                    .setRemoteDescription(
                        new RTCSessionDescription(signal.sdp)
                    )
                    .then(() => {

                        if (signal.sdp.type === 'offer') {
                            connections[fromId].createAnswer()
                                .then(description => {
                                    connections[fromId]
                                        .setLocalDescription(description)
                                        .then(() => {
                                            socketRef.current.emit(
                                                'signal',
                                                fromId,
                                                JSON.stringify({
                                                    sdp: connections[fromId].localDescription
                                                })
                                            );
                                        })
                                        .catch(error => console.log(error));
                                })
                                .catch(error => console.log(error));
                        }
                    })
                    .catch(error => console.log(error));
            }

            if (signal.ice) {
                connections[fromId]
                    .addIceCandidate(
                        new RTCIceCandidate(signal.ice)
                    )
                    .catch(error => console.log(error));
            }
        }
    };

    const fetchWaitingParticipants = async () => {
        const meetingCode = getMeetingCode();

        if (!meetingCode) return;

        try {
            const response = await fetch(
                `${server_url}/api/v1/users/meeting/${encodeURIComponent(meetingCode)}/requests`,
                {
                    credentials: 'include'
                }
            );

            const data = await response.json();

            if (response.ok) {
                setJoinRequests(data.waitingParticipants || []);
            }

        } catch (error) {
            console.error(
                'Unable to fetch waiting participants:',
                error
            );
        }
    };

    const handleParticipantDecision = async (participantId, decision) => {
        const meetingCode = getMeetingCode();

        if (!meetingCode) return;

        try {
            const response = await fetch(
                `${server_url}/api/v1/users/meeting/${encodeURIComponent(meetingCode)}/participants/${participantId}/${decision}`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Unable to ${decision} participant`
                );
            }

            setJoinRequests(current =>
                current.filter(item =>
                    item.participantId !== participantId
                )
            );

        } catch (error) {
            console.error(
                'Participant decision error:',
                error
            );

            setJoinError(error.message);
        }
    };

    const getMeetingCode = () => {
        const pathParts =
            window.location.pathname.split('/').filter(Boolean);

        return decodeURIComponent(
            pathParts[pathParts.length - 1] || ''
        );
    };

    const requestGuestAccess = async () => {
        if (guestJoinAttemptedRef.current) return;

        guestJoinAttemptedRef.current = true;

        try {
            const meetingCode = getMeetingCode();

            const response = await fetch(
                `${server_url}/api/v1/users/join_meeting`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        meetingCode,
                        name: username.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to request meeting access'
                );
            }

            guestCredentialsRef.current = {
                meetingCode: data.meetingCode,
                participantId: data.participantId,
                guestToken: data.guestToken,
                name: data.name || username.trim()
            };

            saveGuestRecovery(guestCredentialsRef.current);

            setHasRecoverySession(true);

            guestJoinAttemptedRef.current = true;

            socketRef.current.emit(
                'join-call',
                guestCredentialsRef.current
            );

        } catch (error) {
            setJoinError(
                error.message ||
                'Unable to join meeting'
            );

            setAskForUsername(true);
            setWaitingForApproval(false);

            guestJoinAttemptedRef.current = false;
        }
    };

    const connectToSocketServer = () => {
        const meetingCode = getMeetingCode();

        if (!meetingCode) {
            setJoinError('Invalid meeting link');
            setAskForUsername(true);
            return;
        }

        socketRef.current = io.connect(server_url, {
            secure: window.location.protocol === 'https:',
            withCredentials: true,
            transports: ['websocket', 'polling']
        });

        socketHandlersAttachedRef.current = false;

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect_error', (error) => {
            console.error(
                'Meeting socket connection error:',
                error
            );

            if (!intentionalLeaveRef.current) {
                setConnectionStatus('reconnecting');
            }
        });

        socketRef.current.on('disconnect', (reason) => {
            if (
                !intentionalLeaveRef.current &&
                !hasLeftMeeting
            ) {
                setConnectionStatus('reconnecting');
                closePeerConnections();
            }

            console.log(
                'Meeting socket disconnected:',
                reason
            );
        });

        socketRef.current.on('connect', () => {
            socketIdRef.current = socketRef.current.id;

            setConnectionStatus('connecting');

            // Socket.IO can reconnect automatically. Attach listeners only once,
            // then re-authenticate/rejoin on every successful socket connection.
            if (!socketHandlersAttachedRef.current) {
                socketHandlersAttachedRef.current = true;

                socketRef.current.on('chat-message', addMessage);

                socketRef.current.on('user-left', (id) => {
                    setVideos(currentVideos =>
                        currentVideos.filter(
                            video => video.socketId !== id
                        )
                    );

                    const updatedParticipants = {
                        ...participantsRef.current
                    };

                    delete updatedParticipants[id];

                    participantsRef.current = updatedParticipants;

                    setParticipants(updatedParticipants);

                    delete connections[id];
                });

                socketRef.current.on(
                    'user-joined',
                    (id, clients, participantDetails = {}) => {

                        // Names and roles are supplied by the server from verified records.
                        participantsRef.current =
                            participantDetails || {};

                        setParticipants(participantsRef.current);

                        setVideos(currentVideos =>
                            currentVideos.map(remoteVideo => ({
                                ...remoteVideo,
                                ...(participantsRef.current[
                                    remoteVideo.socketId
                                ] || {})
                            }))
                        );

                        clients.forEach(socketListId => {
                            if (socketListId === socketIdRef.current) {
                                return;
                            }

                            if (!connections[socketListId]) {
                                connections[socketListId] =
                                    new RTCPeerConnection(
                                        peerConfigConnections
                                    );

                                connections[socketListId].onicecandidate =
                                    function (event) {
                                        if (event.candidate != null) {
                                            socketRef.current.emit(
                                                'signal',
                                                socketListId,
                                                JSON.stringify({
                                                    ice: event.candidate
                                                })
                                            );
                                        }
                                    };

                                const handleRemoteStream = (remoteStream) => {
                                    if (!remoteStream) return;

                                    setVideos(currentVideos => {
                                        const videoExists =
                                            currentVideos.some(
                                                video =>
                                                    video.socketId ===
                                                    socketListId
                                            );

                                        const updatedVideos = videoExists
                                            ? currentVideos.map(video =>
                                                video.socketId === socketListId
                                                    ? {
                                                        ...video,
                                                        stream: remoteStream,
                                                        ...(participantsRef.current[
                                                            socketListId
                                                        ] || {})
                                                    }
                                                    : video
                                            )
                                            : [
                                                ...currentVideos,
                                                {
                                                    socketId: socketListId,
                                                    stream: remoteStream,
                                                    autoplay: true,
                                                    playsinline: true,
                                                    ...(participantsRef.current[
                                                        socketListId
                                                    ] || {})
                                                }
                                            ];

                                        videoRef.current = updatedVideos;

                                        return updatedVideos;
                                    });
                                };

                                // Modern event used by current Chrome, Safari and Firefox.
                                connections[socketListId].ontrack = (event) => {
                                    const remoteStream =
                                        event.streams?.[0] ||
                                        new MediaStream([event.track]);

                                    handleRemoteStream(remoteStream);
                                };

                                // Keep the legacy event as a fallback where available.
                                connections[socketListId].onaddstream = (event) => {
                                    handleRemoteStream(event.stream);
                                };

                                if (window.localStream) {
                                    attachStreamToPeer(
                                        connections[socketListId],
                                        window.localStream
                                    );
                                } else {
                                    const blackSilence = (...args) =>
                                        new MediaStream([
                                            black(...args),
                                            silence()
                                        ]);

                                    window.localStream = blackSilence();

                                    attachStreamToPeer(
                                        connections[socketListId],
                                        window.localStream
                                    );
                                }
                            }
                        });

                        // Only the newly joined participant creates offers.
                        if (id === socketIdRef.current) {
                            for (let id2 of clients) {
                                if (
                                    id2 === socketIdRef.current ||
                                    !connections[id2]
                                ) continue;

                                connections[id2]
                                    .createOffer()
                                    .then(description => {
                                        return connections[id2]
                                            .setLocalDescription(description);
                                    })
                                    .then(() => {
                                        socketRef.current.emit(
                                            'signal',
                                            id2,
                                            JSON.stringify({
                                                sdp: connections[id2].localDescription
                                            })
                                        );
                                    })
                                    .catch(error =>
                                        console.log(
                                            'WebRTC offer error:',
                                            error
                                        )
                                    );
                            }
                        }
                    }
                );

                socketRef.current.on('join-success', (data) => {
                    setWaitingForApproval(false);
                    setJoinError('');
                    setConnectionStatus('connected');
                    setHasLeftMeeting(false);

                    setIsHost(data?.role === 'host');
                    setLocalRole(data?.role || '');

                    // Use the verified display name returned by the server.
                    if (data?.name) {
                        setUsername(data.name);
                    }

                    if (
                        data?.role === 'guest' &&
                        guestCredentialsRef.current
                    ) {
                        guestCredentialsRef.current = {
                            ...guestCredentialsRef.current,
                            name: data.name || username
                        };

                        saveGuestRecovery(guestCredentialsRef.current);

                        setHasRecoverySession(true);
                    }

                    if (data?.role === 'host') {
                        fetchWaitingParticipants();
                    }

                    console.log('Joined meeting:', data);
                });

                socketRef.current.on('waiting-for-approval', () => {
                    setWaitingForApproval(true);
                    setJoinError('');
                });

                socketRef.current.on('guest-admitted', () => {
                    setWaitingForApproval(false);

                    if (guestCredentialsRef.current) {
                        socketRef.current.emit(
                            'join-call',
                            guestCredentialsRef.current
                        );
                    }
                });

                socketRef.current.on('guest-rejected', () => {
                    setWaitingForApproval(false);

                    clearGuestRecovery();

                    setJoinError(
                        'The host declined your request to join this meeting.'
                    );

                    socketRef.current.disconnect();

                    setAskForUsername(true);
                });

                socketRef.current.on('join-error', async (error) => {
                    const errorMessage =
                        error?.message || 'Unable to join meeting';

                    // A stored recovery credential must never silently create a
                    // second participant if it has expired or become invalid.
                    if (guestCredentialsRef.current) {
                        setJoinError(errorMessage);
                        setAskForUsername(true);
                        setWaitingForApproval(false);
                        setConnectionStatus('disconnected');

                        if (
                            /recovery period has expired|invalid guest credentials|meeting not found|meeting has ended/i
                                .test(errorMessage)
                        ) {
                            clearGuestRecovery();
                        }

                        return;
                    }

                    // If the browser session is not the host for this meeting,
                    // continue through the normal guest access request.
                    if (!guestJoinAttemptedRef.current) {
                        await requestGuestAccess();
                        return;
                    }

                    setJoinError(errorMessage);
                    setAskForUsername(true);
                    setWaitingForApproval(false);
                });

                socketRef.current.on('guest-join-request', (request) => {
                    setJoinRequests(current => {
                        if (
                            current.some(
                                item =>
                                    item.participantId ===
                                    request.participantId
                            )
                        ) {
                            return current;
                        }

                        return [...current, request];
                    });

                    console.log(
                        'New guest join request:',
                        request
                    );
                });
            }

            // On first connection and every automatic reconnect, reuse the same
            // guest identity where available. Hosts are identified by session.
            if (guestCredentialsRef.current) {
                guestJoinAttemptedRef.current = true;

                socketRef.current.emit('join-call', {
                    ...guestCredentialsRef.current,
                    meetingCode
                });

            } else {
                guestJoinAttemptedRef.current = false;

                socketRef.current.emit('join-call', {
                    meetingCode
                });
            }
        });
    };

    const silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(
            ctx.createMediaStreamDestination()
        );

        oscillator.start();
        ctx.resume();

        return Object.assign(
            dst.stream.getAudioTracks()[0],
            { enabled: false }
        );
    };

    const black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(
            document.createElement('canvas'),
            { width, height }
        );

        canvas.getContext('2d').fillRect(
            0,
            0,
            width,
            height
        );

        let stream = canvas.captureStream();

        return Object.assign(
            stream.getVideoTracks()[0],
            { enabled: false }
        );
    };

    const handleVideo = () => {
        setVideo(current =>
            current === false ? videoAvailable : false
        );
    };

    const handleAudio = () => {
        setAudio(current =>
            current === false ? audioAvailable : false
        );
    };

    const handleScreen = () => {
        if (screen) {
            stopScreenSharing();
        } else {
            setScreen(true);
            // getDisplayMedia must be invoked directly from the user gesture
            // for Safari and other browsers that enforce the picker activation.
            getDislayMedia();
        }
    };

    // LEAVE MEETING: keep guest recovery credentials for the recovery window.
    const handleEndCall = () => {
        if (intentionalLeaveRef.current) return;

        intentionalLeaveRef.current = true;

        let leaveFinished = false;
        let leaveTimeout;

        const finishLeaving = () => {
            if (leaveFinished) return;

            leaveFinished = true;

            if (leaveTimeout) {
                window.clearTimeout(leaveTimeout);
            }

            if (socketRef.current) {
                socketRef.current.disconnect();
            }

            showLeftMeetingScreen();
        };

        if (socketRef.current?.connected) {
            socketRef.current.once('meeting-left', (result) => {
                if (result?.success === false) {
                    setJoinError(
                        result.message ||
                        'Unable to leave meeting cleanly'
                    );
                }

                finishLeaving();
            });

            socketRef.current.emit('leave-meeting');

            // Keep the UI responsive if the server does not acknowledge the
            // leave event (for example, while the network is already offline).
            leaveTimeout = window.setTimeout(
                finishLeaving,
                1200
            );

        } else {
            finishLeaving();
        }
    };

    const openChat = () => {
        setModal(true);
        setNewMessages(0);
    };

    const closeChat = () => {
        setModal(false);
    };

    const toggleChat = () => {
        if (showModal) {
            closeChat();
        } else {
            openChat();
        }
    };

    const handleMessage = (e) => {
        setMessage(e.target.value);
    };

    const addMessage = (data, sender, socketIdSender, role) => {
        setMessages(prevMessages => [
            ...prevMessages,
            {
                sender: sender || 'Participant',
                role: role || 'guest',
                data
            }
        ]);

        if (
            socketIdSender !== socketIdRef.current &&
            !showModal
        ) {
            setNewMessages(prevNewMessages =>
                prevNewMessages + 1
            );
        }
    };

    const sendMessage = () => {
        if (!message.trim() || !socketRef.current) return;

        socketRef.current.emit(
            'chat-message',
            message,
            username
        );

        setMessage('');
    };

    const connect = () => {
        const displayName =
            username.trim() ||
            userData?.name?.trim() ||
            '';

        if (
            !displayName &&
            !guestCredentialsRef.current
        ) return;

        if (displayName) {
            setUsername(displayName);
        }

        setJoinError('');
        intentionalLeaveRef.current = false;

        guestJoinAttemptedRef.current =
            Boolean(guestCredentialsRef.current);

        setAskForUsername(false);
        setWaitingForApproval(false);

        getMedia();
    };

    const cameraEnabled =
        video !== false && videoAvailable;

    const microphoneEnabled =
        audio !== false && audioAvailable;

    const participantCount = videos.length + 1;
    const isFocusView =
        meetingViewMode === 'focus' ||
        (meetingViewMode === 'auto' && participantCount === 2);

    const selectedRemoteExists = videos.some(
        remoteVideo => remoteVideo.socketId === selectedParticipantId
    );

    let featuredParticipantId = selectedParticipantId;

    if (
        featuredParticipantId &&
        featuredParticipantId !== 'local' &&
        !selectedRemoteExists
    ) {
        featuredParticipantId = null;
    }

    // In a two-person meeting, show the other person as the main video by default.
    // In focus mode with multiple people, fall back to the first available remote
    // participant if the previously selected participant has disconnected.
    if (!featuredParticipantId && videos.length > 0) {
        featuredParticipantId = videos[0].socketId;
    } else if (!featuredParticipantId) {
        featuredParticipantId = 'local';
    }

    const focusParticipant = (participantId) => {
        setSelectedParticipantId(participantId);
        setMeetingViewMode('focus');
    };

    const showParticipantGrid = () => {
        setSelectedParticipantId(null);
        setMeetingViewMode('grid');
    };

    const renderLocalParticipantTile = ({
        className = '',
        style = {},
        onClick
    } = {}) => (
        <div
            className={`${styles.videoTile} ${className}`}
            style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
            onClick={onClick}
            onKeyDown={onClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            } : undefined}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-label={onClick ? `Feature ${username || 'your'} video` : undefined}
        >
            <video
                className={styles.localParticipantVideo}
                ref={element => {
                    localVideoref.current = element;
                    if (element && cameraStreamRef.current) {
                        element.srcObject = cameraStreamRef.current;
                        element.play?.().catch(() => {});
                    }
                }}
                autoPlay
                muted
                playsInline
                style={{ transform: 'scaleX(-1)', WebkitTransform: 'scaleX(-1)' }}
            />

            {!cameraEnabled && (
                <div className={styles.participantCameraOff}>
                    <div className={styles.participantAvatar}>
                        {username ? username.charAt(0).toUpperCase() : '👤'}
                    </div>
                </div>
            )}

            <div className={styles.participantName}>
                <span className={styles.participantStatusDot}></span>
                {username || 'You'} (You)
                {localRole && (
                    <span className={styles.participantRole}>
                        {localRole === 'host' ? 'Host' : 'Guest'}
                    </span>
                )}
            </div>

            {!microphoneEnabled && (
                <div className={styles.participantMuted}>
                    <MicOffIcon />
                </div>
            )}
        </div>
    );

    const renderRemoteParticipantTile = ({
        remoteVideo,
        className = '',
        style = {},
        onClick
    }) => {
        const participant = participants[remoteVideo.socketId] || {};
        const participantName = remoteVideo.name || participant.name || 'Participant';
        const participantRole = remoteVideo.role || participant.role;

        return (
            <div
                key={remoteVideo.socketId}
                className={`${styles.videoTile} ${className}`}
                style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
                onClick={onClick}
                onKeyDown={onClick ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onClick();
                    }
                } : undefined}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
                aria-label={onClick ? `Feature ${participantName}` : undefined}
            >
                <video
                    className={styles.remoteParticipantVideo}
                    data-socket={remoteVideo.socketId}
                    ref={element => {
                        if (element && remoteVideo.stream) {
                            element.srcObject = remoteVideo.stream;
                        }
                    }}
                    autoPlay
                    playsInline
                    style={{ transform: 'none', WebkitTransform: 'none' }}
                />

                <div className={styles.participantName}>
                    <span className={styles.participantStatusDot}></span>
                    {participantName}
                    <span className={styles.participantRole}>
                        {participantRole === 'host' ? 'Host' : 'Guest'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.videoMeetPage}>

            {askForUsername ? (

                /* PRE-JOIN LOBBY */

                <div className={styles.preJoinPage}>

                    <nav className={styles.preJoinNavbar}>

                        <div className={styles.preJoinBrand}>
                            <div
                                className={styles.preJoinBrandIcon}
                                style={{ backgroundColor: "#5A65E0" }}
                            >
                                <ConnectSphereLogoMark />
                            </div>

                            <h2 style={{ color: "#192032" }}>
                                Connect<span style={{ color: "#5A65E0" }}>Sphere</span>
                            </h2>
                        </div>

                        <div className={styles.secureLabel}>
                            <LockOutlinedIcon />
                            <span>Secure meeting</span>
                        </div>

                    </nav>

                    <main className={styles.preJoinContent}>

                        <section className={styles.preJoinLeft}>

                            <div className={styles.cameraPreview}>

                                <video
                                    ref={element => {
                                        localVideoref.current = element;
                                        if (element && cameraStreamRef.current) {
                                            element.srcObject = cameraStreamRef.current;
                                            element.play?.().catch(() => {});
                                        }
                                    }}
                                    autoPlay
                                    muted
                                    playsInline
                                    style={{ transform: 'scaleX(-1)', WebkitTransform: 'scaleX(-1)' }}
                                />

                                {!cameraEnabled && (
                                    <div className={styles.cameraOffOverlay}>
                                        <div className={styles.cameraOffAvatar}>
                                            {username
                                                ? username.charAt(0).toUpperCase()
                                                : '👤'}
                                        </div>

                                        <p>Camera is turned off</p>
                                    </div>
                                )}

                                <div className={styles.previewLabel}>
                                    <span className={styles.liveDot}></span>
                                    Camera preview
                                </div>

                                <div className={styles.previewName}>
                                    {username || 'Your preview'}
                                </div>

                            </div>

                            <div className={styles.preJoinControls}>

                                <button
                                    type="button"
                                    className={`${styles.deviceButton} ${
                                        !microphoneEnabled ? styles.deviceOff : ''
                                    }`}
                                    onClick={handleAudio}
                                    disabled={!audioAvailable}
                                >
                                    {microphoneEnabled
                                        ? <MicIcon />
                                        : <MicOffIcon />}

                                    <span>
                                        {microphoneEnabled
                                            ? 'Mic on'
                                            : 'Mic off'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`${styles.deviceButton} ${
                                        !cameraEnabled ? styles.deviceOff : ''
                                    }`}
                                    onClick={handleVideo}
                                    disabled={!videoAvailable}
                                >
                                    {cameraEnabled
                                        ? <VideocamIcon />
                                        : <VideocamOffIcon />}

                                    <span>
                                        {cameraEnabled
                                            ? 'Camera on'
                                            : 'Camera off'}
                                    </span>
                                </button>

                            </div>

                        </section>

                        <section className={styles.preJoinRight}>

                            <div className={styles.preJoinBadge}>
                                <span></span>
                                Ready when you are
                            </div>

                            <h1>
                                {hasRecoverySession
                                    ? 'Welcome back.'
                                    : 'Your meeting'}
                                <br />
                                {hasRecoverySession
                                    ? 'Rejoin your meeting.'
                                    : 'starts here.'}
                            </h1>

                            <p className={styles.preJoinDescription}>
                                Get ready to connect. Check your camera and
                                microphone, then join the conversation.
                                {hasRecoverySession &&
                                    ' Your previous guest identity has been found.'}
                            </p>

                            {joinError && (
                                <p
                                    role="alert"
                                    style={{ color: '#d32f2f' }}
                                >
                                    {joinError}
                                </p>
                            )}

                            <div className={styles.usernameField}>

                                <label htmlFor="meeting-username">
                                    Your name
                                </label>

                                <TextField
                                    id="meeting-username"
                                    fullWidth
                                    placeholder="Enter your name"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    variant="outlined"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            connect();
                                        }
                                    }}
                                />

                            </div>

                            <Button
                                fullWidth
                                variant="contained"
                                className={styles.joinNowButton}
                                onClick={connect}
                                disabled={
                                    !username.trim() &&
                                    !hasRecoverySession &&
                                    !userData?.name
                                }
                                endIcon={<ArrowForwardIcon />}
                            >
                                {hasRecoverySession
                                    ? 'Rejoin meeting'
                                    : 'Join meeting'}
                            </Button>

                            <div className={styles.preJoinNote}>
                                <LockOutlinedIcon />

                                <span>
                                    Your meeting is private and secure.
                                </span>
                            </div>

                        </section>

                    </main>

                    <footer className={styles.preJoinFooter}>
                        <span>© ConnectSphere</span>
                        <span>Connect. Collaborate. Communicate.</span>
                    </footer>

                </div>

            ) : waitingForApproval ? (

                <div className={styles.preJoinPage}>
                    <div className={styles.preJoinContent}>
                        <section className={styles.preJoinRight}>
                            <div className={styles.preJoinBadge}>
                                <span></span>
                                Request submitted
                            </div>

                            <h1>Waiting for the host</h1>

                            <p className={styles.preJoinDescription}>
                                Your request has been sent. You will enter the meeting
                                automatically when the host admits you.
                            </p>

                            <Button
                                variant="outlined"
                                onClick={handleEndCall}
                            >
                                Cancel request
                            </Button>
                        </section>
                    </div>
                </div>

            ) : hasLeftMeeting ? (

                /* POST-LEAVE REJOIN SCREEN */

                <div className={styles.rejoinPage}>
                    <div className={styles.rejoinCard}>

                        <div className={styles.rejoinIcon}>
                            <CallEndIcon />
                        </div>

                        <span className={styles.rejoinEyebrow}>
                            MEETING PAUSED FOR YOU
                        </span>

                        <h1>You have left the meeting</h1>

                        <p>
                            You can rejoin this meeting while its recovery window is active,
                            or return to the ConnectSphere home page.
                        </p>

                        {joinError && (
                            <p
                                role="alert"
                                className={styles.rejoinError}
                            >
                                {joinError}
                            </p>
                        )}

                        <div className={styles.rejoinActions}>

                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleRejoinMeeting}
                                endIcon={<ArrowForwardIcon />}
                            >
                                Rejoin meeting
                            </Button>

                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleReturnHome}
                            >
                                Return to Home
                            </Button>

                        </div>
                    </div>
                </div>

            ) : (

                /* ACTIVE MEETING ROOM */

                <div className={styles.meetVideoContainer}>

                    {/* Meeting header */}

                    <header className={styles.meetingHeader}>

                        <div className={styles.meetingHeaderBrand}>
                            <span
                                className={styles.meetingBrandIcon}
                                style={{ backgroundColor: "#5A65E0" }}
                            >
                                <ConnectSphereLogoMark />
                            </span>
                            <span>
                                Connect<span style={{ color: "#5A65E0" }}>Sphere</span>
                            </span>
                        </div>

                        <div className={styles.meetingHeaderInfo}>
                            <span className={styles.meetingLiveDot}></span>
                            <span>
                                {connectionStatus === 'connected'
                                    ? 'Meeting in progress'
                                    : connectionStatus === 'reconnecting'
                                        ? 'Reconnecting...'
                                        : 'Connecting...'}
                            </span>
                        </div>

                        <div className={styles.meetingParticipantCount}>
                            {videos.length + 1} participant
                            {videos.length === 0 ? '' : 's'}
                        </div>

                    </header>

                    {isHost && joinRequests.length > 0 && (
                        <section
                            style={{
                                padding: '12px 20px',
                                background: '#f5f7ff',
                                color: '#20243a'
                            }}
                        >
                            <strong>
                                Join requests ({joinRequests.length})
                            </strong>

                            {joinRequests.map(request => (
                                <div
                                    key={request.participantId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        paddingTop: '8px'
                                    }}
                                >
                                    <span style={{ flex: 1 }}>
                                        {request.name}
                                    </span>

                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() =>
                                            handleParticipantDecision(
                                                request.participantId,
                                                'admit'
                                            )
                                        }
                                    >
                                        Admit
                                    </Button>

                                    <Button
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        onClick={() =>
                                            handleParticipantDecision(
                                                request.participantId,
                                                'reject'
                                            )
                                        }
                                    >
                                        Reject
                                    </Button>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Main meeting content */}

                    <main
                        className={`${styles.meetingMain} ${
                            showModal ? styles.meetingMainWithChat : ''
                        }`}
                    >

                        <div className={styles.meetingStage}>

                            {!isFocusView ? (
                                <div className={styles.conferenceView}>
                                    {renderLocalParticipantTile({
                                        onClick: () => focusParticipant('local')
                                    })}

                                    {videos.map(remoteVideo =>
                                        renderRemoteParticipantTile({
                                            remoteVideo,
                                            onClick: () => focusParticipant(remoteVideo.socketId)
                                        })
                                    )}
                                </div>
                            ) : (
                                <div className={`${styles.participantFocusView} ${
                                    participantCount > 2 ? styles.participantFocusViewWithRail : ''
                                }`}>
                                    <div className={styles.featuredParticipantArea}>
                                        {featuredParticipantId === 'local'
                                            ? renderLocalParticipantTile({
                                                className: styles.featuredParticipantTile
                                            })
                                            : renderRemoteParticipantTile({
                                                remoteVideo: videos.find(
                                                    item => item.socketId === featuredParticipantId
                                                ) || videos[0],
                                                className: styles.featuredParticipantTile
                                            })}

                                        {/* In a two-person meeting, the other participant is
                                            featured while your own camera stays in a corner preview. */}
                                        {participantCount === 2 && featuredParticipantId !== 'local' &&
                                            renderLocalParticipantTile({
                                                className: styles.hostSelfView,
                                                onClick: () => focusParticipant('local')
                                            })}

                                        {participantCount === 2 && featuredParticipantId === 'local' &&
                                            videos[0] && renderRemoteParticipantTile({
                                                remoteVideo: videos[0],
                                                className: styles.hostSelfView,
                                                onClick: () => focusParticipant(videos[0].socketId)
                                            })}
                                    </div>

                                    {participantCount > 2 && (
                                        <aside className={styles.participantThumbnailStrip} aria-label="Other participants">
                                            {featuredParticipantId !== 'local' &&
                                                renderLocalParticipantTile({
                                                    className: styles.participantThumbnailTile,
                                                    onClick: () => focusParticipant('local')
                                                })}

                                            {videos
                                                .filter(item => item.socketId !== featuredParticipantId)
                                                .map(remoteVideo =>
                                                    renderRemoteParticipantTile({
                                                        remoteVideo,
                                                        className: styles.participantThumbnailTile,
                                                        onClick: () => focusParticipant(remoteVideo.socketId)
                                                    })
                                                )}
                                        </aside>
                                    )}

                                    <div className={styles.participantFocusToolbar}>
                                        <span>
                                            {participantCount === 2
                                                ? 'Two-person view'
                                                : 'Focused participant'}
                                        </span>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={showParticipantGrid}
                                            className={styles.participantViewAction}
                                        >
                                            Back to grid
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Empty meeting state */}

                            {videos.length === 0 && (
                                <div className={styles.waitingForParticipants}>
                                    <div className={styles.waitingIcon}>👥</div>
                                    <h3>You're the first one here</h3>
                                    <p>Share the meeting link to invite others.</p>
                                </div>
                            )}

                        </div>

                        {/* Chat sidebar */}

                        {showModal && (
                            <aside className={styles.chatRoom}>

                                <div className={styles.chatContainer}>

                                    <div className={styles.chatHeader}>

                                        <div>
                                            <h1>Meeting chat</h1>
                                            <p>Messages shared with everyone</p>
                                        </div>

                                        <IconButton
                                            onClick={closeChat}
                                            aria-label="Close chat"
                                        >
                                            <span>×</span>
                                        </IconButton>

                                    </div>

                                    <div className={styles.chattingDisplay}>

                                        {messages.length !== 0 ? (
                                            messages.map((item, index) => (

                                                <div
                                                    className={`${styles.chatMessage} ${
                                                        item.role === 'host'
                                                            ? styles.hostChatMessage
                                                            : styles.guestChatMessage
                                                    }`}
                                                    key={index}
                                                >
                                                    <p className={styles.chatSender}>
                                                        {item.sender}

                                                        {item.role && (
                                                            <span className={styles.chatSenderRole}>
                                                                {' · '}
                                                                {item.role === 'host'
                                                                    ? 'Host'
                                                                    : 'Guest'}
                                                            </span>
                                                        )}
                                                    </p>

                                                    <p className={styles.chatMessageText}>
                                                        {item.data}
                                                    </p>
                                                </div>

                                            ))
                                        ) : (
                                            <div className={styles.emptyChat}>
                                                <ChatIcon />
                                                <p>No messages yet</p>
                                                <span>
                                                    Start a conversation with everyone.
                                                </span>
                                            </div>
                                        )}

                                    </div>

                                    <div className={styles.chattingArea}>

                                        <TextField
                                            fullWidth
                                            value={message}
                                            onChange={handleMessage}
                                            placeholder="Enter your message"
                                            variant="outlined"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    sendMessage();
                                                }
                                            }}
                                        />

                                        <Button
                                            variant="contained"
                                            onClick={sendMessage}
                                            disabled={!message.trim()}
                                        >
                                            Send
                                        </Button>

                                    </div>

                                </div>

                            </aside>
                        )}

                    </main>

                    {/* Bottom meeting controls */}

                    <footer className={styles.meetingControls}>

                        <div className={styles.meetingControlGroup}>

                            <div className={styles.controlWithLabel}>
                                <IconButton
                                    className={`${styles.meetingControlButton} ${
                                        !microphoneEnabled
                                            ? styles.controlDisabled
                                            : ''
                                    }`}
                                    onClick={handleAudio}
                                    aria-label="Toggle microphone"
                                    title="Toggle microphone"
                                >
                                    {microphoneEnabled
                                        ? <MicIcon />
                                        : <MicOffIcon />}
                                </IconButton>

                                <span>
                                    {microphoneEnabled ? 'Mute' : 'Unmute'}
                                </span>
                            </div>

                            <div className={styles.controlWithLabel}>
                                <IconButton
                                    className={`${styles.meetingControlButton} ${
                                        !cameraEnabled
                                            ? styles.controlDisabled
                                            : ''
                                    }`}
                                    onClick={handleVideo}
                                    aria-label="Toggle camera"
                                    title="Toggle camera"
                                >
                                    {cameraEnabled
                                        ? <VideocamIcon />
                                        : <VideocamOffIcon />}
                                </IconButton>

                                <span>
                                    {cameraEnabled ? 'Stop video' : 'Start video'}
                                </span>
                            </div>

                            {screenAvailable === true && (
                                <div className={styles.controlWithLabel}>
                                    <IconButton
                                        className={`${styles.meetingControlButton} ${
                                            screen
                                                ? styles.controlActive
                                                : ''
                                        }`}
                                        onClick={handleScreen}
                                        aria-label="Share screen"
                                        title="Share a window or screen; your camera preview stays visible locally"
                                    >
                                        {screen
                                            ? <StopScreenShareIcon />
                                            : <ScreenShareIcon />}
                                    </IconButton>

                                    <span>Share screen</span>
                                </div>
                            )}

                            <div className={styles.controlWithLabel}>
                                <Badge
                                    badgeContent={newMessages}
                                    color="error"
                                    invisible={newMessages === 0}
                                >
                                    <IconButton
                                        className={`${styles.meetingControlButton} ${
                                            showModal
                                                ? styles.controlActive
                                                : ''
                                        }`}
                                        onClick={toggleChat}
                                        aria-label="Toggle chat"
                                        title="Meeting chat"
                                    >
                                        <ChatIcon />
                                    </IconButton>
                                </Badge>

                                <span>Chat</span>
                            </div>

                            <div className={styles.controlWithLabel}>
                                <IconButton
                                    className={styles.endCallButton}
                                    onClick={handleEndCall}
                                    aria-label="End call"
                                    title="End call"
                                >
                                    <CallEndIcon />
                                </IconButton>

                                <span>Leave</span>
                            </div>

                        </div>

                    </footer>

                </div>
            )}

        </div>
    );
}
