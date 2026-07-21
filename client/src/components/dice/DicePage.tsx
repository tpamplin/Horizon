// =============================================================================
// Horizon — DicePage Component
// =============================================================================
// Composes DiceTray, DiceAnimation, and DiceLogPanel for the campaign
// dice tab. This is the full dice rolling experience.
// =============================================================================

import { useParams } from 'react-router-dom';
import { DiceTray } from './DiceTray.js';
import { DiceAnimation } from './DiceAnimation.js';
import { DiceLogPanel } from './DiceLogPanel.js';
import './DicePage.css';

export function DicePage() {
  const { id: campaignId } = useParams<{ id: string }>();

  return (
    <div className="dice-page" role="region" aria-label="Dice roller">
      <DiceTray />
      <DiceAnimation />
      {campaignId && <DiceLogPanel campaignId={campaignId} />}
    </div>
  );
}
