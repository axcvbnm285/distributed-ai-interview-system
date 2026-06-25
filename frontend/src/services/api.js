import axios from "axios";
import BACKEND_URL from "./backendUrl";

const BASE_URL = import.meta.env.VITE_API_URL || BACKEND_URL;

console.log("========== API DEBUG ==========");
console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
console.log("BACKEND_URL:", BACKEND_URL);
console.log("BASE_URL:", BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
});

export default api;