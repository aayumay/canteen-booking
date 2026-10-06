import axiosClient from "./axiosClient.js";

export async function getAllergenPreferences() {
  const { data } = await axiosClient.get("/student/allergens");
  return data;
}

export async function updateAllergenPreferences(allergens) {
  const { data } = await axiosClient.patch("/student/allergens", { allergens });
  return data;
}

export const nutritionApi = {
  getAllergenPreferences,
  updateAllergenPreferences,
};
