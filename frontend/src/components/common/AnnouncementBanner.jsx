import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { announcementApi } from "../../api/announcementApi.js";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dismissed_announcements") || "[]");
    } catch {
      return [];
    }
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["activeAnnouncements"],
    queryFn: announcementApi.getActiveAnnouncements,
    refetchInterval: 60000,
  });

  const activeVisible = announcements.filter((a) => !dismissed.includes(a.id));

  if (activeVisible.length === 0) return null;

  const handleDismiss = (id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    try {
      sessionStorage.setItem("dismissed_announcements", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="announcement-stack" role="region" aria-label="System announcements">
      {activeVisible.map((ann) => (
        <div key={ann.id} className="announcement-item">
          <div className="announcement-content">
            <span className="announcement-tag">CAMPUS NOTICE</span>
            <strong className="announcement-title">{ann.title}</strong>
            <p className="announcement-msg">{ann.message}</p>
          </div>
          <button
            type="button"
            className="announcement-dismiss"
            onClick={() => handleDismiss(ann.id)}
            aria-label="Dismiss announcement"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
