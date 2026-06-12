//this file is inspected - but changes will be needed to done later, its just axios.
import axios from "axios";
import type { AxiosInstance } from "axios";

export const axiosInstance: AxiosInstance = axios.create({
// ??$$$ newer code
  baseURL:
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://localhost:5000/api"
      : "/api"),
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Bypass-Tunnel-Reminder": "true"
  }
});