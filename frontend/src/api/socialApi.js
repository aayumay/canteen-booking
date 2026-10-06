import axiosClient from "./axiosClient.js";

export async function updateSocialProfile(payload) {
  const { data } = await axiosClient.patch("/student/profile/social", payload);
  return data;
}

export async function getLeaderboard(limit = 10) {
  const { data } = await axiosClient.get("/student/leaderboard", { params: { limit } });
  return data;
}

export const socialApi = {
  updateSocialProfile,
  getLeaderboard,
};
