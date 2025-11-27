'use client';

import { useSearchParams } from 'next/navigation';
import { GameLayout } from "./components/game-layout";
import { Suspense } from 'react';

function GamePageContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'player';

  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <GameLayout role={role as 'master' | 'player' | 'group'} />
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
