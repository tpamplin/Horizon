// =============================================================================
// Horizon — Background Layer
// =============================================================================
// Full-viewport decorative layer behind all UI. Shows a campaign background
// image (cover) or a dark gradient fallback. Purely visual — not interactive.
// =============================================================================

import './BackgroundLayer.css';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface BackgroundLayerProps {
  /** URL of the active background image, or null for the default gradient. */
  url: string | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BackgroundLayer({ url }: BackgroundLayerProps) {
  return (
    <div
      className="background-layer"
      aria-hidden="true"
      style={
        url
          ? { backgroundImage: `url(${url})` }
          : undefined
      }
    />
  );
}
