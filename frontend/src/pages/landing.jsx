import React, { useContext, useState } from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import VideoCallIcon from "@mui/icons-material/VideoCall";

export default function LandingPage() {
    const router = useNavigate();

    const {
        userData,
        isLoading,
        handleLogout
    } = useContext(AuthContext);

    const [loggingOut, setLoggingOut] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [footerDialog, setFooterDialog] = useState(null);

    const isAuthenticated = Boolean(userData);
    const displayName = userData?.name || userData?.username || "User";

    const logout = async () => {
        try {
            setLoggingOut(true);
            await handleLogout();
        } finally {
            setLoggingOut(false);
        }
    };

    const goToMeeting = () => {
        router(isAuthenticated ? "/home" : "/auth");
    };

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <div className="landingPageContainer" id="top">
            {/* Bordered sticky navigation */}
            <nav className="landingNavbar" aria-label="Main navigation">
                <div className="navHeader">
                    <Link to="/" className="connectSphereBrand" onClick={closeMobileMenu}>
                        <span className="connectSphereBrandMark" aria-hidden="true">
                            <VideoCallIcon />
                        </span>
                        <span className="connectSphereBrandName">
                            Connect<span>Sphere</span>
                        </span>
                    </Link>
                </div>

                <button
                    type="button"
                    className="landingMenuToggle"
                    aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen(open => !open)}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <div className={`navlist ${mobileMenuOpen ? "navlistOpen" : ""}`}>
                    <a href="#home" onClick={closeMobileMenu}>Home</a>
                    <a href="#features" onClick={closeMobileMenu}>Features</a>
                    <a href="#how-it-works" onClick={closeMobileMenu}>How It Works</a>
                    <a href="#about" onClick={closeMobileMenu}>About</a>
                    <a href="#contact" onClick={closeMobileMenu}>Contact</a>
                </div>

                <div className="navActions">
                    {isLoading ? (
                        <span className="sessionChecking">Checking session...</span>
                    ) : isAuthenticated ? (
                        <>
                            <span className="welcomeUser">Welcome, {displayName}</span>
                            <button className="loginBtn" onClick={() => router("/home")}>
                                Dashboard
                            </button>
                            <button className="loginBtn historyNavBtn" onClick={() => router("/history")}>
                                History
                            </button>
                            <button className="signupBtn" onClick={logout} disabled={loggingOut}>
                                {loggingOut ? "Logging out..." : "Logout"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="loginBtn" onClick={() => router("/auth")}>
                                Login
                            </button>
                            <button className="signupBtn" onClick={() => router("/auth")}>
                                Sign Up
                            </button>
                        </>
                    )}
                </div>
            </nav>

            <main>
                {/* Hero */}
                <section className="landingMainContainer landingSection" id="home">
                    <div className="heroContent">
                        <div className="heroBadge">Video Conferencing Made Simple</div>
                        <h1>
                            Connect.
                            <br />
                            Collaborate.
                            <br />
                            <span>Without Limits.</span>
                        </h1>
                        <p className="heroDescription">
                            Meet face-to-face from anywhere. ConnectSphere brings people
                            together with simple video meetings, real-time conversations,
                            and tools that help teams share ideas.
                        </p>

                        <div className="heroButtons">
                            <button className="startMeetingBtn" onClick={goToMeeting}>
                                <span aria-hidden="true">▣</span>
                                Start a Meeting
                            </button>
                            <button className="joinMeetingBtn" onClick={goToMeeting}>
                                <span aria-hidden="true">👥</span>
                                Join a Meeting
                            </button>
                        </div>

                        <div className="heroTrustLine">
                            <span className="heroTrustDot"></span>
                            Browser-based meetings · Simple guest access · Real-time chat
                        </div>
                    </div>

                    <div className="heroVisual" aria-label="Illustration of a four-person video meeting">
                        <div className="visualCircle visualCircleBlue"></div>
                        <div className="visualCircle visualCirclePurple"></div>

                        <div className="meetingLaptop">
                            <div className="laptopScreen">
                                <div className="landingPreviewTopbar">
                                    <span><i></i> Live meeting</span>
                                    <span>ConnectSphere</span>
                                </div>
                                <div className="videoGrid">
                                    <div className="videoTile tileOne">
                                        <div className="personAvatar">S</div>
                                        <span className="participantName">You</span>
                                    </div>
                                    <div className="videoTile tileTwo">
                                        <div className="personAvatar">A</div>
                                        <span className="participantName">Alex</span>
                                    </div>
                                    <div className="videoTile tileThree">
                                        <div className="personAvatar">J</div>
                                        <span className="participantName">John</span>
                                    </div>
                                    <div className="videoTile tileFour">
                                        <div className="personAvatar">P</div>
                                        <span className="participantName">Priya</span>
                                    </div>
                                </div>
                                <div className="meetingControls" aria-hidden="true">
                                    <span>🎙</span>
                                    <span>📹</span>
                                    <span>🖥</span>
                                    <span>💬</span>
                                    <span>•••</span>
                                    <span className="endCall">☎</span>
                                </div>
                            </div>
                            <div className="laptopBase"></div>
                        </div>

                        <div className="floatingCard teamCard">
                            <span className="floatingIcon">👥</span>
                            <div><strong>Team Meeting</strong><small>Everyone in one place</small></div>
                        </div>
                        <div className="floatingCard chatCard">
                            <span className="floatingIcon">💬</span>
                            <strong>Real-time Chat</strong>
                        </div>
                        <div className="floatingCard ideasCard">
                            <span className="floatingIcon">💡</span>
                            <strong>Share Ideas</strong>
                        </div>
                    </div>
                </section>

                {/* Feature highlights */}
                <section className="landingFeatures landingSection" id="features">
                    <div className="sectionHeading">
                        <span className="sectionEyebrow">WHAT YOU CAN DO</span>
                        <h2>Everything you need to <span>stay connected</span></h2>
                        <p>Thoughtful meeting tools make online conversations easier and more productive.</p>
                    </div>

                    <div className="landingFeatureGrid">
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconBlue">▣</div>
                            <h3>HD Video Meetings</h3>
                            <p>Meet face-to-face with a clear, flexible video layout that adapts to your conversation.</p>
                        </article>
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconGreen">◉</div>
                            <h3>Live Audio & Controls</h3>
                            <p>Control your microphone and camera whenever you need to listen, speak, or step away.</p>
                        </article>
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconPurple">▤</div>
                            <h3>Screen Sharing</h3>
                            <p>Share your screen to walk others through documents, demos, and ideas together.</p>
                        </article>
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconOrange">▱</div>
                            <h3>Real-time Chat</h3>
                            <p>Send messages during a meeting so links, notes, and quick updates stay in the conversation.</p>
                        </article>
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconPink">▦</div>
                            <h3>Grid & Focus Views</h3>
                            <p>See the group together or focus on a specific participant with one click.</p>
                        </article>
                        <article className="landingFeatureCard">
                            <div className="landingFeatureIcon featureIconTeal">↗</div>
                            <h3>Guest Access</h3>
                            <p>Invite guests through a meeting link, with host approval available for restricted rooms.</p>
                        </article>
                    </div>
                </section>

                {/* How it works */}
                <section className="landingHowSection landingSection" id="how-it-works">
                    <div className="sectionHeading">
                        <span className="sectionEyebrow">GET STARTED IN MOMENTS</span>
                        <h2>How <span>ConnectSphere</span> works</h2>
                        <p>Go from invitation to conversation in three simple steps.</p>
                    </div>

                    <div className="howStepsGrid">
                        <article className="howStepCard">
                            <div className="howStepNumber">01</div>
                            <div className="howStepIcon">＋</div>
                            <h3>Create a meeting</h3>
                            <p>Open your dashboard and create a meeting room with the access settings you need.</p>
                        </article>
                        <div className="howStepConnector" aria-hidden="true">→</div>
                        <article className="howStepCard">
                            <div className="howStepNumber">02</div>
                            <div className="howStepIcon">↗</div>
                            <h3>Share the invitation</h3>
                            <p>Copy the meeting link and send it to the people you want to bring together.</p>
                        </article>
                        <div className="howStepConnector" aria-hidden="true">→</div>
                        <article className="howStepCard">
                            <div className="howStepNumber">03</div>
                            <div className="howStepIcon">◎</div>
                            <h3>Meet and collaborate</h3>
                            <p>Join the conversation, share your screen, chat, and switch between participant views.</p>
                        </article>
                    </div>
                </section>

                {/* About */}
                <section className="landingAboutSection landingSection" id="about">
                    <div className="aboutVisual">
                        <div className="aboutVisualCard aboutVisualMain">
                            <div className="aboutVisualBadge"><span></span> Made for conversations</div>
                            <div className="aboutVisualHeadline">Bring your people<br /><span>closer together.</span></div>
                            <div className="aboutAvatarRow">
                                <span>S</span><span>A</span><span>J</span><span>P</span><b>+</b>
                            </div>
                            <small>One shared space to connect</small>
                        </div>
                        <div className="aboutFloatingNote">💬 &nbsp; Ideas flow better together</div>
                    </div>

                    <div className="aboutContent">
                        <span className="sectionEyebrow">ABOUT CONNECTSPHERE</span>
                        <h2>Conversations should feel <span>closer, not harder.</span></h2>
                        <p>
                            ConnectSphere is a browser-based video meeting experience designed
                            to make it easier for people to come together. Whether you are
                            catching up with friends, collaborating with classmates, or
                            discussing work with a team, the goal is simple: spend less time
                            figuring out the tools and more time having the conversation.
                        </p>
                        <p>
                            With meeting links, guest access, participant controls, screen
                            sharing, and live chat, ConnectSphere brings the essentials of an
                            online meeting into one straightforward place.
                        </p>
                        <button className="aboutExploreBtn" onClick={goToMeeting}>
                            Try ConnectSphere <span aria-hidden="true">→</span>
                        </button>
                    </div>
                </section>

                {/* Why ConnectSphere */}
                <section className="landingWhySection landingSection" id="why-connectsphere">
                    <div className="sectionHeading">
                        <span className="sectionEyebrow">MADE FOR EVERYDAY COLLABORATION</span>
                        <h2>A simple space for <span>better meetings</span></h2>
                    </div>
                    <div className="whyPointsGrid">
                        <div className="whyPoint"><span>✓</span><div><h3>Easy to join</h3><p>Share a meeting link and bring participants into the same room.</p></div></div>
                        <div className="whyPoint"><span>✓</span><div><h3>Flexible participation</h3><p>Use open access or request-based entry for more control over a room.</p></div></div>
                        <div className="whyPoint"><span>✓</span><div><h3>Stay in the flow</h3><p>Move between video, chat, and screen sharing without leaving the meeting.</p></div></div>
                        <div className="whyPoint"><span>✓</span><div><h3>Pick your perspective</h3><p>Choose grid view or focus on the participant you want to see.</p></div></div>
                    </div>
                </section>

                {/* Contact / CTA */}
                <section className="landingContactSection landingSection" id="contact">
                    <div className="contactCtaContent">
                        <span className="sectionEyebrow">YOUR NEXT CONVERSATION STARTS HERE</span>
                        <h2>Ready to <span>connect?</span></h2>
                        <p>Create a room, invite your people, and make space for a great conversation.</p>
                        <button className="contactCtaButton" onClick={goToMeeting}>
                            Get Started <span aria-hidden="true">→</span>
                        </button>
                    </div>
                    <div className="contactCtaOrb" aria-hidden="true">👥</div>
                </section>
            </main>

            {/* Footer */}
            <footer className="landingFooter">
                <div className="landingFooterTop">
                    <div className="landingFooterBrand">
                        <Link
                            to="/"
                            className="connectSphereBrand connectSphereBrand--small"
                            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        >
                            <span className="connectSphereBrandMark" aria-hidden="true">
                                <VideoCallIcon />
                            </span>
                            <span className="connectSphereBrandName">
                                Connect<span>Sphere</span>
                            </span>
                        </Link>
                        <p className="landingFooterTagline">Connect. Collaborate. Communicate.</p>
                        <p className="landingFooterDescription">
                            Simple video meetings for the conversations that matter.
                        </p>
                    </div>

                    <div className="landingFooterColumn">
                        <h3>Company</h3>
                        <a href="#about">About ConnectSphere</a>
                    </div>

                    <div className="landingFooterColumn">
                        <h3>Support</h3>
                        <a href="#contact">Contact support</a>
                    </div>

                    <div className="landingFooterColumn">
                        <h3>Legal</h3>
                        <button type="button" onClick={() => setFooterDialog("privacy")}>
                            Privacy Policy
                        </button>
                        <button type="button" onClick={() => setFooterDialog("terms")}>
                            Terms of Service
                        </button>
                    </div>
                </div>

                <div className="landingFooterBottom">
                    <span>© {new Date().getFullYear()} ConnectSphere. All rights reserved.</span>
                    <a href="#top">Back to top ↑</a>
                </div>
            </footer>

            {footerDialog && (
                <div
                    className="footerDialogOverlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setFooterDialog(null);
                    }}
                >
                    <section
                        className="footerDialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="footerDialogTitle"
                    >
                        <button
                            type="button"
                            className="footerDialogClose"
                            aria-label="Close dialog"
                            onClick={() => setFooterDialog(null)}
                        >
                            ×
                        </button>

                        {footerDialog === "privacy" ? (
                            <>
                                <span className="footerDialogEyebrow">CONNECTSPHERE · PRIVACY</span>
                                <h2 id="footerDialogTitle">Privacy Policy</h2>
                                <p>
                                    ConnectSphere uses the information needed to provide account access
                                    and meeting features. This project summary should be checked against
                                    the final production data practices before public launch.
                                </p>
                                <h3>Information used in the app</h3>
                                <p>
                                    Account details are used for sign-in and to identify your account.
                                    Your display name and meeting role may be visible to other people
                                    in the same meeting. Chat messages are delivered to participants
                                    in that meeting.
                                </p>
                                <h3>Camera, microphone and screen sharing</h3>
                                <p>
                                    These features use browser permissions. Audio, video and shared
                                    screen content are transmitted for the live meeting when you enable
                                    the relevant feature.
                                </p>
                                <h3>Before public release</h3>
                                <p>
                                    The final policy should specify data retention and deletion periods,
                                    hosting and service providers, the process for account deletion, and
                                    a privacy contact address.
                                </p>
                            </>
                        ) : (
                            <>
                                <span className="footerDialogEyebrow">CONNECTSPHERE · TERMS</span>
                                <h2 id="footerDialogTitle">Terms of Service</h2>
                                <p>
                                    By using ConnectSphere, you agree to use the service lawfully and
                                    respectfully. This is a starter summary and should be reviewed and
                                    completed before the app is offered publicly.
                                </p>
                                <h3>Respect other participants</h3>
                                <p>
                                    Join only meetings you are permitted to access. Do not disrupt
                                    meetings, attempt unauthorized access, or share content that violates
                                    another person's rights or privacy.
                                </p>
                                <h3>Media and meeting content</h3>
                                <p>
                                    Use camera, microphone, chat and screen sharing considerately. Get
                                    appropriate consent before recording, capturing or redistributing
                                    another participant's content.
                                </p>
                                <h3>Service availability</h3>
                                <p>
                                    Meeting quality and availability may depend on your device, browser
                                    and network connection. Do not rely on the service for emergency
                                    communications.
                                </p>
                            </>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
