// =============================================================================
// Horizon — PortraitUpload Component
// =============================================================================
// File upload component for character portraits. Reads the selected image
// file as a base64 data URL and sends it to POST /api/upload. Shows a
// circular preview and loading/error states.
// =============================================================================

import { useState, useRef } from 'react';
import { api } from '../../api/client.js';
import './PortraitUpload.css';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PortraitUploadProps {
  /** Called with the uploaded image URL on success. */
  onPortraitChange: (url: string) => void;
  /** Current portrait URL (for preview of existing portrait). */
  currentUrl?: string | null;
}

/** Allowed image MIME types. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Maximum file size in bytes (5 MB). */
const MAX_SIZE = 5 * 1024 * 1024;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PortraitUpload({ onPortraitChange, currentUrl }: PortraitUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please use PNG, JPEG, GIF, or WebP.');
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 5 MB.`);
      return;
    }

    setError(null);

    // Read file as base64
    const dataUrl = await readFileAsDataUrl(file);
    setPreview(dataUrl);

    // Upload
    setUploading(true);
    try {
      const result = await api.post<{ url: string }>('/api/upload', { image: dataUrl });
      onPortraitChange(result.url);
      setPreview(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      // Revert preview to previous URL
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="portrait-upload">
      <div className="portrait-upload-preview" aria-label="Portrait preview">
        {preview ? (
          <img src={preview} alt="Character portrait preview" className="portrait-preview-img" />
        ) : (
          <div className="portrait-preview-empty" aria-hidden="true">?</div>
        )}
      </div>

      <div className="portrait-upload-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleInputChange}
          className="portrait-file-input"
          aria-label="Choose a portrait image file"
        />
        <button
          type="button"
          className="portrait-browse-btn"
          onClick={handleBrowse}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : preview ? 'Change Portrait' : 'Choose Portrait'}
        </button>
        {preview && !uploading && (
          <button
            type="button"
            className="portrait-remove-btn"
            onClick={() => {
              setPreview(null);
              onPortraitChange('');
            }}
            aria-label="Remove portrait"
          >
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className="portrait-upload-error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
