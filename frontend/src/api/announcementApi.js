import axiosClient from "./axiosClient.js";

export const announcementApi = {
  getActiveAnnouncements: async () => {
    const { data } = await axiosClient.get("/announcements");
    return data;
  },
};
