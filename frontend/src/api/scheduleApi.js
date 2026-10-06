import axiosClient from "./axiosClient.js";

export async function listSchedule() {
  const { data } = await axiosClient.get("/student/schedule");
  return data;
}

export async function addScheduleEntry(entry) {
  const { data } = await axiosClient.post("/student/schedule", entry);
  return data;
}

export async function deleteScheduleEntry(entryId) {
  const { data } = await axiosClient.delete(`/student/schedule/${entryId}`);
  return data;
}

export async function getUpcomingBreak() {
  const { data } = await axiosClient.get("/student/schedule/upcoming-break");
  return data;
}

export const scheduleApi = {
  listSchedule,
  addScheduleEntry,
  deleteScheduleEntry,
  getUpcomingBreak,
};
