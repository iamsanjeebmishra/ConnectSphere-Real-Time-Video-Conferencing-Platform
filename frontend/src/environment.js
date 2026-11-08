const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

const server = isLocalhost
    ? "http://localhost:8000"
    : "https://connectsphere-backend-63gk.onrender.com";

export default server;