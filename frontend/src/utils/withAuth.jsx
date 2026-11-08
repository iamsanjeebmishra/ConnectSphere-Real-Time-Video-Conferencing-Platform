
import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

const withAuth = (WrappedComponent) => {

    const AuthComponent = (props) => {

        const { userData, isLoading } = useContext(AuthContext);

        // Wait until browser session validation finishes.
        if (isLoading) {
            return null;
        }

        // Redirect if the session is missing or expired.
        if (!userData) {
            return <Navigate to="/auth" replace />;
        }

        // Render protected component for authenticated users.
        return <WrappedComponent {...props} />;
    };

    return AuthComponent;
};

export default withAuth;
