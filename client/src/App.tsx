import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { RegisterPage } from './components/auth/RegisterPage.js';
import { LoginPage } from './components/auth/LoginPage.js';
import { AuthGuard } from './components/auth/AuthGuard.js';
import { CampaignListPage } from './components/campaigns/CampaignListPage.js';
import { CampaignLayout } from './components/campaigns/CampaignLayout.js';
import { SheetView } from './components/sheets/SheetView.js';
import { CharacterLibraryPage } from './components/sheets/CharacterLibraryPage.js';
import { NewCharacterPage } from './components/sheets/NewCharacterPage.js';
import { NPCLibraryPage } from './components/sheets/NPCLibraryPage.js';
import { HomePage } from './components/home/HomePage.js';
import { DicePage } from './components/dice/DicePage.js';
import { useAuthStore } from './stores/authStore.js';

/** Minimal placeholder for future feature pages. */
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="campaign-placeholder">
      <p>{title} — coming soon</p>
    </div>
  );
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/campaigns"
          element={
            <AuthGuard>
              <CampaignListPage />
            </AuthGuard>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <AuthGuard>
              <CampaignLayout />
            </AuthGuard>
          }
        >
          <Route index element={<PlaceholderPage title="Campaign" />} />
          <Route path="sheets" element={<PlaceholderPage title="Sheets" />} />
          <Route path="dice" element={<DicePage />} />
          <Route path="chat" element={<PlaceholderPage title="Chat" />} />
          <Route path="backgrounds" element={<PlaceholderPage title="Backgrounds" />} />
        </Route>
        <Route
          path="/campaigns/:campaignId/characters/:characterId"
          element={
            <AuthGuard>
              <SheetView />
            </AuthGuard>
          }
        />
        <Route
          path="/characters"
          element={
            <AuthGuard>
              <CharacterLibraryPage />
            </AuthGuard>
          }
        />
        <Route
          path="/characters/new"
          element={
            <AuthGuard>
              <NewCharacterPage />
            </AuthGuard>
          }
        />
        <Route
          path="/characters/:characterId"
          element={
            <AuthGuard>
              <SheetView />
            </AuthGuard>
          }
        />
        <Route
          path="/npcs"
          element={
            <AuthGuard>
              <NPCLibraryPage />
            </AuthGuard>
          }
        />
        <Route
          path="/npcs/:npcId"
          element={
            <AuthGuard>
              <PlaceholderPage title="NPC Viewer" />
            </AuthGuard>
          }
        />\n        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
