# ConnectSphere – Real-Time Video Conferencing Platform

ConnectSphere is a real-time video conferencing platform built using the MERN stack. It enables users to create and join meetings, communicate through live audio and video, share screens, and collaborate with other participants.

The platform uses WebRTC for peer-to-peer media communication, Socket.IO for real-time events and signaling, and MongoDB for storing user accounts, meeting information, and sessions.

## 🚀 Live Demo

**Live Application:** [ConnectSphere – Try it here](https://connectsphere-frontend-8rvh.onrender.com)

## ✨ Features

### 1. Real-Time Video Conferencing
- Audio and video communication powered by **WebRTC** and browser MediaStream APIs.
- Peer-to-peer connection establishment using WebRTC offers, answers, and ICE candidates.
- Camera and microphone controls.
- Real-time participant media status updates using **Socket.IO**.
- Screen sharing through the browser MediaDevices API.
- Participant grid and focused video layouts implemented with **React.js**.

### 2. Meeting Management
- Create and join meetings using unique meeting codes through **Node.js and Express.js** APIs.
- Host and guest roles with participant access management.
- Guest join requests with host admission and rejection through **Socket.IO**.
- Meeting invitation links for sharing meeting access.
- Meeting history management using **MongoDB and Mongoose**.
- Guest reconnection and meeting recovery support.

### 3. Real-Time Communication
- Live meeting chat using **Socket.IO** for instant message broadcasting.
- Camera and microphone status synchronization between participants.
- Participant joining and leaving notifications.
- WebRTC signaling coordinated through the **Socket.IO server**.

### 4. Authentication and Security
- User registration and login using **Express.js** and **bcrypt** password hashing.
- Session-based authentication with **express-session**.
- Persistent session storage using **connect-mongo** and MongoDB.
- Protected backend routes and authenticated meeting operations.
- Secure session cookies for production deployment.

### 5. User Interface
- Responsive user interface developed using **React.js, Material UI, and CSS Modules**.
- Interactive meeting controls with Material UI icons.
- Landing page, authentication pages, meeting dashboard, and meeting history.
- Participant video tiles with camera-off and microphone-muted indicators.

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, JavaScript, HTML5, CSS3 |
| UI Framework | Material UI, CSS Modules |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Real-Time Communication | Socket.IO |
| Video Conferencing | WebRTC, MediaStream API |
| Authentication | bcrypt, express-session |
| Session Storage | connect-mongo |
| API Communication | REST APIs, Axios |
| Development Tools | Nodemon, npm |
| Deployment | Render |
| Version Control | Git, GitHub |

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- MongoDB Atlas account or local MongoDB installation
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/iamsanjeebmishra/ConnectSphere-Real-Time-Video-Conferencing-Platform.git

cd ConnectSphere
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=8000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret

CLIENT_URLS=http://localhost:3000

SESSION_MAX_AGE_DAYS=7
MEETING_RECONNECT_GRACE_MINUTES=30
```

Replace the MongoDB connection string and session secret with your own values.

Start the backend:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:8000
```

### 3. Frontend Setup

Open another terminal from the project root:

```bash
cd frontend
npm install
```

Start the React development server:

```bash
npm start
```

The frontend will run at:

```text
http://localhost:3000
```

### 4. Run the Application

Open the frontend in your browser, register or log in, create a meeting, and invite another participant using the meeting link.

## 🌐 Deployment

ConnectSphere is deployed using **Render**.

### Backend Configuration

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Configure the following environment variables in the Render dashboard:

```env
NODE_ENV=production
CLIENT_URLS=https://connectsphere-frontend-8rvh.onrender.com
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
```

### Frontend Configuration

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `build` |

The frontend automatically selects the local backend when accessed through localhost and the deployed backend when accessed through the production domain.

**Security Note:** Never commit `.env` files, database credentials, or session secrets to GitHub.

## 🔄 How It Works

1. A host creates a meeting through the Express.js backend.
2. Guests request access using a meeting code or invitation link.
3. The backend validates the host session or guest credentials.
4. Socket.IO manages participant events and WebRTC signaling.
5. WebRTC establishes peer-to-peer audio and video connections.
6. Participants exchange messages, share screens, and synchronize media status in real time.
7. MongoDB stores user information, meeting records, and persistent sessions.

## 🔮 Future Improvements

- Meeting recording and playback.
- Virtual backgrounds and background blur.
- Advanced meeting scheduling.
- Group video conferencing optimizations.
- Improved scalability for larger meetings.

## 👨‍💻 Author

**Sanjeeb Kumar Mishra**

MCA – Artificial Intelligence & Internet of Things  
National Institute of Technology, Patna

**GitHub:** [@iamsanjeebmishra](https://github.com/iamsanjeebmishra)

---

⭐ If you find ConnectSphere interesting, consider giving the repository a star!
