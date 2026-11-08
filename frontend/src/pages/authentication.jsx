
import * as React from "react";

import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    IconButton,
    InputAdornment,
    Checkbox,
    FormControlLabel,
    Snackbar,
    Alert,
    Divider
} from "@mui/material";

import {
    Visibility,
    VisibilityOff,
    Videocam,
    Security
} from "@mui/icons-material";

import { AuthContext } from "../contexts/AuthContext";
import { useSearchParams } from "react-router-dom";


// ConnectSphere camera-plus brand mark
function ConnectSphereMark({
    size = 46,
    tileColor = "#5A65E0",
    plusColor = "#5A65E0"
}) {
    return (
        <Box
            aria-hidden="true"
            sx={{
                width: size,
                height: size,
                flex: `0 0 ${size}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: `${Math.round(size * 0.28)}px`,
                backgroundColor: tileColor
            }}
        >
            <svg
                viewBox="0 0 64 48"
                width="76%"
                height="68%"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M7 7H39C41.2 7 43 8.8 43 11V37C43 39.2 41.2 41 39 41H7C4.8 41 3 39.2 3 37V11C3 8.8 4.8 7 7 7Z"
                    fill="#FFFFFF"
                />
                <path
                    d="M43 16L61 5V43L43 32V16Z"
                    fill="#FFFFFF"
                />
                <path
                    d="M23 15V33M14 24H32"
                    stroke={plusColor}
                    strokeWidth="5.5"
                    strokeLinecap="square"
                />
            </svg>
        </Box>
    );
}

export default function Authentication() {

    const [searchParams, setSearchParams] = useSearchParams();

    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");

    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");

    // Open the registration form when the URL contains ?mode=signup.
    const [formState, setFormState] = React.useState(
        () => searchParams.get("mode") === "signup" ? 1 : 0
    );
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);

    // Remember login session
    const [rememberMe, setRememberMe] = React.useState(false);

    const { handleRegister, handleLogin } =
        React.useContext(AuthContext);


    // Keep the selected form and URL mode in sync.
    const switchForm = (state) => {
        setFormState(state);
        setSearchParams(
            state === 1 ? { mode: "signup" } : {},
            { replace: true }
        );
        setError("");
        setPassword("");
    };

    // Also respond if navigation changes the query string while this page is mounted.
    React.useEffect(() => {
        setFormState(searchParams.get("mode") === "signup" ? 1 : 0);
    }, [searchParams]);


    // Login and Registration
    const handleAuth = async (e) => {

        e.preventDefault();

        setError("");

        if (!username.trim() || !password.trim()) {
            setError("Please enter your email and password.");
            return;
        }

        if (formState === 1 && !name.trim()) {
            setError("Please enter your full name.");
            return;
        }

        try {

            setLoading(true);

            if (formState === 0) {

                await handleLogin(username, password, rememberMe);

            } else {

                const result = await handleRegister(
                    name,
                    username,
                    password
                );

                setMessage(result || "Registration successful!");
                setOpen(true);

                setUsername("");
                setPassword("");
                setName("");

                switchForm(0);
            }

        } catch (err) {

            console.error(err);

            const errorMessage =
                err?.response?.data?.message ||
                err?.message ||
                "Something went wrong. Please try again.";

            setError(errorMessage);

        } finally {

            setLoading(false);

        }
    };


    return (

        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #edf4ff 0%, #ffffff 50%, #edf0ff 100%)",
                padding: { xs: 2, md: 4 }
            }}
        >

            <Paper
                elevation={0}
                sx={{
                    width: "100%",
                    maxWidth: "1050px",
                    minHeight: { xs: "auto", md: "620px" },
                    display: "flex",
                    overflow: "hidden",
                    borderRadius: "24px",
                    border: "1px solid #e8edf5",
                    boxShadow: "0 15px 50px rgba(40, 75, 130, 0.10)"
                }}
            >

                {/* LEFT PANEL */}

                <Box
                    sx={{
                        width: { xs: "0%", md: "45%" },
                        display: { xs: "none", md: "flex" },
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: 5,
                        color: "white",
                        background: "linear-gradient(145deg, #5A65E0 0%, #5145CD 100%)",
                        position: "relative",
                        overflow: "hidden"
                    }}
                >

                    {/* BRAND LOGO */}

                    <Box sx={{ position: "relative", zIndex: 2 }}>

                        <Box display="flex" alignItems="center" gap={1.2}>

                            <ConnectSphereMark
                                size={50}
                                tileColor="rgba(255,255,255,0.16)"
                                plusColor="#5A65E0"
                            />

                            <Typography
                                variant="h5"
                                fontWeight="bold"
                                sx={{
                                    color: "#FFFFFF",
                                    letterSpacing: "-0.8px"
                                }}
                            >
                                Connect
                                <Box
                                    component="span"
                                    sx={{ color: "#C9CCFF" }}
                                >
                                    Sphere
                                </Box>
                            </Typography>

                        </Box>

                    </Box>


                    {/* LEFT PANEL CONTENT */}

                    <Box
                        sx={{
                            position: "relative",
                            zIndex: 2
                        }}
                    >

                        <Videocam
                            sx={{
                                fontSize: 75,
                                mb: 2,
                                opacity: 0.95
                            }}
                        />

                        <Typography
                            variant="h3"
                            fontWeight="bold"
                            lineHeight={1.2}
                            mb={2}
                        >
                            Connect.
                            <br />
                            Collaborate.
                            <br />
                            Without Limits.
                        </Typography>

                        <Typography
                            fontSize={16}
                            sx={{
                                color: "#e5edff",
                                lineHeight: 1.8,
                                maxWidth: 350
                            }}
                        >
                            Bring your team together with simple,
                            secure and seamless video meetings.
                        </Typography>

                    </Box>


                    {/* FOOTER */}

                    <Box
                        sx={{
                            position: "relative",
                            zIndex: 2
                        }}
                    >

                        <Divider
                            sx={{
                                borderColor: "rgba(255,255,255,0.25)",
                                mb: 2
                            }}
                        />

                        <Box display="flex" alignItems="center" gap={1}>

                            <Security />

                            <Typography fontSize={13}>
                                ConnectSphere - Video meetings made simple
                            </Typography>

                        </Box>

                    </Box>


                    {/* DECORATIVE CIRCLES */}

                    <Box
                        sx={{
                            position: "absolute",
                            width: 350,
                            height: 350,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)",
                            top: 100,
                            right: -180
                        }}
                    />

                    <Box
                        sx={{
                            position: "absolute",
                            width: 250,
                            height: 250,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)",
                            bottom: -100,
                            left: -100
                        }}
                    />

                </Box>


                {/* RIGHT PANEL - AUTH FORM */}

                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: { xs: 3, sm: 5, md: 6 }
                    }}
                >

                    <Box sx={{ width: "100%", maxWidth: 390 }}>

                        {/* MOBILE LOGO */}

                        <Box
                            sx={{
                                display: { xs: "flex", md: "none" },
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 1,
                                mb: 4
                            }}
                        >

                            <ConnectSphereMark size={42} />

                            <Typography
                                variant="h5"
                                fontWeight="bold"
                                color="#172033"
                            >
                                Connect
                                <Box
                                    component="span"
                                    sx={{ color: "#5A65E0" }}
                                >
                                    Sphere
                                </Box>
                            </Typography>

                        </Box>


                        {/* HEADING */}

                        <Typography
                            variant="h4"
                            fontWeight="bold"
                            textAlign="center"
                            color="#172033"
                            mb={1}
                        >
                            {formState === 0
                                ? "Welcome Back"
                                : "Create an Account"}
                        </Typography>


                        <Typography
                            textAlign="center"
                            color="text.secondary"
                            fontSize={14}
                            mb={4}
                        >
                            {formState === 0
                                ? "Login to your account to continue with ConnectSphere"
                                : "Join ConnectSphere and start meeting without limits"}
                        </Typography>


                        {/* AUTHENTICATION FORM */}

                        <Box
                            component="form"
                            onSubmit={handleAuth}
                        >

                            {/* FULL NAME */}

                            {formState === 1 && (

                                <TextField
                                    fullWidth
                                    required
                                    label="Full Name"
                                    value={name}
                                    onChange={(e) =>
                                        setName(e.target.value)
                                    }
                                    margin="normal"
                                    autoComplete="name"
                                />

                            )}


                            {/* EMAIL / USERNAME */}

                            <TextField
                                fullWidth
                                required
                                label="Email address"
                                type="text"
                                value={username}
                                onChange={(e) =>
                                    setUsername(e.target.value)
                                }
                                margin="normal"
                                autoComplete="username"
                            />


                            {/* PASSWORD */}

                            <TextField
                                fullWidth
                                required
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                margin="normal"
                                autoComplete={
                                    formState === 0
                                        ? "current-password"
                                        : "new-password"
                                }
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">

                                            <IconButton
                                                onClick={() =>
                                                    setShowPassword(!showPassword)
                                                }
                                                edge="end"
                                                aria-label="Toggle password visibility"
                                            >
                                                {showPassword
                                                    ? <VisibilityOff />
                                                    : <Visibility />
                                                }
                                            </IconButton>

                                        </InputAdornment>
                                    )
                                }}
                            />


                            {/* REMEMBER ME */}

                            {formState === 0 && (

                                <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    mt={1}
                                >

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={rememberMe}
                                                onChange={(e) =>
                                                    setRememberMe(e.target.checked)
                                                }
                                            />
                                        }
                                        label={
                                            <Typography fontSize={13}>
                                                Remember me
                                            </Typography>
                                        }
                                    />

                                </Box>

                            )}


                            {/* ERROR */}

                            {error && (

                                <Typography
                                    color="error"
                                    fontSize={13}
                                    mt={2}
                                >
                                    {error}
                                </Typography>

                            )}


                            {/* SUBMIT BUTTON */}

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                disabled={loading}
                                sx={{
                                    mt: 3,
                                    mb: 2,
                                    height: 50,
                                    borderRadius: "10px",
                                    background: "#5A65E0",
                                    fontSize: 16,
                                    fontWeight: 600,
                                    textTransform: "none",
                                    boxShadow: "0 6px 15px rgba(90,101,224,0.18)",

                                    "&:hover": {
                                        background: "#4C56D3"
                                    }
                                }}
                            >
                                {loading
                                    ? "Please wait..."
                                    : formState === 0
                                        ? "Login"
                                        : "Sign Up"}
                            </Button>

                        </Box>


                        {/* SWITCH LOGIN / SIGNUP */}

                        <Divider sx={{ my: 2 }}>
                            <Typography
                                color="text.secondary"
                                fontSize={12}
                            >
                                OR
                            </Typography>
                        </Divider>


                        <Typography
                            textAlign="center"
                            fontSize={14}
                            color="text.secondary"
                        >

                            {formState === 0
                                ? "Don't have an account?"
                                : "Already have an account?"}

                            <Button
                                onClick={() =>
                                    switchForm(formState === 0 ? 1 : 0)
                                }
                                sx={{
                                    textTransform: "none",
                                    fontWeight: 600,
                                    color: "#5A65E0",
                                    ml: 0.5
                                }}
                            >
                                {formState === 0
                                    ? "Sign Up"
                                    : "Login"}
                            </Button>

                        </Typography>

                    </Box>

                </Box>

            </Paper>


            {/* REGISTRATION SNACKBAR */}

            <Snackbar
                open={open}
                autoHideDuration={4000}
                onClose={() => setOpen(false)}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "center"
                }}
            >

                <Alert
                    severity="success"
                    variant="filled"
                    onClose={() => setOpen(false)}
                >
                    {message}
                </Alert>

            </Snackbar>

        </Box>

    );

}
