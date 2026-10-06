import axios from "axios";
import axiosClient, { API_BASE_URL } from "./axiosClient.js";

/** POST /auth/request-otp — {phone_number, role} → 202 {detail} */
export async function requestOtp({ phone_number, role }) {
  const { data } = await axiosClient.post("/auth/request-otp", { phone_number, role });
  return data;
}

/** POST /auth/verify-otp — {phone_number, otp_code, name?} → {access_token, refresh_token} */
export async function verifyOtp({ phone_number, otp_code, name }) {
  const { data } = await axiosClient.post("/auth/verify-otp", {
    phone_number,
    otp_code,
    ...(name ? { name } : {}),
  });
  return data;
}

/** POST /auth/refresh — {refresh_token} → {access_token, refresh_token, token_type} */
export async function refreshAccessToken(refreshToken) {
  const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
    refresh_token: refreshToken,
  });
  return data;
}

/** POST /auth/register-vendor — {phone_number, name, shop_name, stall_photo_url?} → UserOut */
export async function registerVendor({ phone_number, name, shop_name, stall_photo_url }) {
  const { data } = await axiosClient.post("/auth/register-vendor", {
    phone_number,
    name,
    shop_name,
    ...(stall_photo_url ? { stall_photo_url } : {}),
  });
  return data;
}

/** POST /auth/register-admin — {phone_number, name} → UserOut */
export async function registerAdmin({ phone_number, name }) {
  const { data } = await axiosClient.post("/auth/register-admin", {
    phone_number,
    name,
  });
  return data;
}

/** GET /auth/me → UserOut */
export async function getMe() {
  const { data } = await axiosClient.get("/auth/me");
  return data;
}

export const authApi = { requestOtp, verifyOtp, refreshAccessToken, registerVendor, registerAdmin, getMe };

