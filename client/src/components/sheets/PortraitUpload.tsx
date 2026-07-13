// =============================================================================
// Horizon — PortraitUpload Component
// =============================================================================
// Circular portrait with an edit-icon overlay. Clicking the circle opens a
// file picker. Shows a spinner during upload and an error message on failure.
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
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use PNG, JPEG, GIF, or WebP.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max 5 MB.`);
      return;
    }
    setError(null);

    const dataUrl = await readFileAsDataUrl(file);
    setPreview(dataUrl);
    setUploading(true);
    try {
      const result = await api.post<{ url: string }>('/api/upload', { image: dataUrl });
      onPortraitChange(result.url);
      setPreview(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onPortraitChange('');
  };

  return (
    <div className="portrait-upload-circle" onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }} aria-label={preview ? 'Change portrait' : 'Add portrait'}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleInputChange}
        className="portrait-file-input"
        aria-label="Choose a portrait image file"
      />
      {preview ? (
        <img src={preview} alt="Character portrait" className="portrait-circle-img" />
      ) : (
        <div className="portrait-circle-empty" aria-hidden="true">
          {currentUrl ? '?' : '?'}
        </div>
      )}
      {uploading && (
        <div className="portrait-upload-spinner" aria-label="Uploading portrait" />
      )}
      <span className="portrait-edit-badge" aria-hidden="true">✎</span>
      {preview && (
        <button
          type="button"
          className="portrait-remove-badge"
          onClick={handleRemove}
          aria-label="Remove portrait"
          tabIndex={-1}
        >
          ×
        </button>
      )}
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
