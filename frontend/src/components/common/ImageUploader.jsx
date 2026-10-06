import { useState, useRef } from "react";
import axiosClient from "../../api/axiosClient.js";
import { resolveImageUrl } from "../../lib/format.js";
import { Spinner } from "./Spinner.jsx";

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({
  value,
  onUploaded,
  onRemove,
  label = "Photo",
  helperText = "JPEG, PNG, or WebP up to 5MB",
  compact = false,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image exceeds ${MAX_SIZE_MB}MB size limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await axiosClient.post("/media/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const url = response.data.url;
      onUploaded(url);
    } catch (err) {
      setError(err?.message || "Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (onRemove) onRemove();
    else if (onUploaded) onUploaded("");
  };

  return (
    <div className={`image-uploader-wrap ${compact ? "image-uploader-compact" : ""}`}>
      {label && <label className="form-label">{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: "none" }}
        disabled={isUploading}
      />

      {value ? (
        <div className="image-uploader-preview-card">
          <img
            src={resolveImageUrl(value)}
            alt="Uploaded preview"
            className="image-uploader-img"
          />
          <div className="image-uploader-overlay">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Change
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={handleRemove}
              disabled={isUploading}
            >
              Remove
            </button>
          </div>
          {isUploading && (
            <div className="image-uploader-loading-mask">
              <Spinner size="md" />
              <span className="small">Uploading...</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`image-uploader-dropzone ${isUploading ? "uploading" : ""}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          {isUploading ? (
            <div className="image-uploader-loading-inner">
              <Spinner size="md" />
              <span className="small muted">Uploading photo...</span>
            </div>
          ) : (
            <div className="image-uploader-prompt">
              <span className="image-uploader-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              </span>
              <span className="image-uploader-action-text">Click to choose a photo</span>
              {helperText && <span className="image-uploader-helper small muted">{helperText}</span>}
            </div>
          )}
        </div>
      )}

      {error && <p className="form-error" role="alert" style={{ marginTop: "6px" }}>{error}</p>}
    </div>
  );
}
