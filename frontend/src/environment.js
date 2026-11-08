const IS_PROD = true;

const server = IS_PROD
    ? "https://connectsphere-backend-63gk.onrender.com"
    : "http://localhost:8000";

export default server;