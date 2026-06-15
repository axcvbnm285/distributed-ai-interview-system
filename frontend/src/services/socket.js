import { io } from "socket.io-client";
import BACKEND_URL from "./backendUrl";

const socket = io(import.meta.env.VITE_SOCKET_URL || BACKEND_URL);

export default socket;
