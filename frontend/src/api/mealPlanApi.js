import axiosClient from "./axiosClient.js";

export async function listAvailablePlans() {
  const { data } = await axiosClient.get("/student/meal-plans");
  return data;
}

export async function subscribeToPlan(planId) {
  const { data } = await axiosClient.post(`/student/meal-plans/${planId}/subscribe`);
  return data;
}

export async function getMySubscriptions() {
  const { data } = await axiosClient.get("/student/my-meal-plans");
  return data;
}

export async function vendorListPlans() {
  const { data } = await axiosClient.get("/vendor/meal-plans");
  return data;
}

export async function vendorCreatePlan(payload) {
  const { data } = await axiosClient.post("/vendor/meal-plans", payload);
  return data;
}

export async function vendorUpdatePlan(planId, payload) {
  const { data } = await axiosClient.patch(`/vendor/meal-plans/${planId}`, payload);
  return data;
}

export const mealPlanApi = {
  listAvailablePlans,
  subscribeToPlan,
  getMySubscriptions,
  vendorListPlans,
  vendorCreatePlan,
  vendorUpdatePlan,
};
