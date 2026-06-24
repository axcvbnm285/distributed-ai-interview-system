const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
const fallbackBackendUrl = import.meta.env.DEV
  ? "http://localhost:3001"
  : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3001";

const BACKEND_URL = configuredBackendUrl || fallbackBackendUrl;

export default BACKEND_URL;
