import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Dices className="h-12 w-12 text-primary sm:h-16 sm:w-16" />
          <h1 className="font-headline text-4xl text-accent sm:text-6xl">
            Un GDR a caso
          </h1>
        </div>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Benvenuto sul tuo tavolo da gioco digitale per epiche campagne GDR. Scegli il tuo ruolo per iniziare l'avventura.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/game?role=master">Entra come Master</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/game?role=player">Entra come Giocatore</Link>
          </Button>
           <Button asChild variant="secondary" size="lg">
            <Link href="/game?role=group">Entra come Gruppo</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
