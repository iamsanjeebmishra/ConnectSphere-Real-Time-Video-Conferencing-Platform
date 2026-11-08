
import axios from "axios";
import httpStatus from "http-status";
import {
    createContext,
    useCallback,
    useEffect,
    useState
} from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`,
    withCredentials: true
});

export const AuthProvider = ({ children }) => {
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const router = useNavigate();

    // CHECK EXISTING SESSION
    const checkAuth = useCallback(async () => {
        try {
            const request = await client.get("/session");

            setUserData(request.data.user || null);

            return request.data.user || null;

        } catch (error) {
            setUserData(null);
            return null;

        } finally {
            setIsLoading(false);
        }
    }, []);

    // VALIDATE SESSION WHEN APPLICATION LOADS
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // REGISTER USER
    const handleRegister = async (name, username, password) => {
        try {
            const request = await client.post("/register", {
                name,
                username,
                password
            });

            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }

        } catch (error) {
            throw error;
        }
    };

    // LOGIN USER
    const handleLogin = async (username, password, rememberMe = false) => {
        try {
            const request = await client.post("/login", {
                username,
                password,
                rememberMe
            });

            if (request.status === httpStatus.OK) {

                const user = request.data.user || {
                    name: request.data.name,
                    username: request.data.username
                };

                setUserData(user);

                router("/home");

                return request.data;
            }

        } catch (error) {
            throw error;
        }
    };

    // LOGOUT USER
    const handleLogout = async () => {
        try {
            await client.post("/logout");

        } catch (error) {
            console.error("Logout error:", error);

        } finally {
            setUserData(null);
            router("/");
        }
    };

    // GET USER MEETING HISTORY
    const getHistoryOfUser = useCallback(async () => {
        try {
            const request = await client.get("/get_all_activity");

            return request.data;

        } catch (error) {
            throw error;
        }
    }, []);

    // ADD MEETING TO USER HISTORY
    const addToUserHistory = useCallback(async (meetingCode) => {
        try {
            const request = await client.post("/add_to_activity", {
                meeting_code: meetingCode
            });

            return request;

        } catch (error) {
            throw error;
        }
    }, []);

    const data = {
        userData,
        setUserData,
        isLoading,
        isAuthenticated: Boolean(userData),
        checkAuth,
        handleRegister,
        handleLogin,
        handleLogout,
        getHistoryOfUser,
        addToUserHistory
    };

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    );
};
