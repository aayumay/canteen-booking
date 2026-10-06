import axiosClient from "./axiosClient.js";

export const walletApi = {
  getWallet: async () => {
    const { data } = await axiosClient.get("/student/wallet");
    return data;
  },
  updateThreshold: async (low_balance_threshold) => {
    const { data } = await axiosClient.patch("/student/wallet/threshold", {
      low_balance_threshold,
    });
    return data;
  },
  adjustWallet: async ({ student_id, amount, reason }) => {
    const { data } = await axiosClient.post("/admin/wallet/adjust", {
      student_id,
      amount,
      reason,
    });
    return data;
  },
  searchStudents: async (search = "") => {
    const { data } = await axiosClient.get("/admin/students", {
      params: { search: search || undefined },
    });
    return data;
  },
};
