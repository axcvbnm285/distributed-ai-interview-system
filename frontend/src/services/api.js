import axios from "axios";
import BACKEND_URL from "./backendUrl";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || BACKEND_URL,
});

export default api;
