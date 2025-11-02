import React from 'react';
import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { TurnTracker } from './turn-tracker';
import type { Character } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Separator } from '../ui/separator';

interface GameSidebarProps {
  characters: Character[];
  currentTurnId: string | null;
  onInitiativeChange: (characterId: string, initiative: number) => Promise<void>;
  onNextTurn: () => void;
  onPreviousTurn: () => void;
  onAddCharacter: () => void;
  onToggleVisibility: (characterId: string, isVisible: boolean) => void;
  onCharacterClick: (characterId: string) => void;
  role: 'master' | 'player' | 'group';
}

export function GameSidebar({ characters, currentTurnId, onInitiativeChange, onNextTurn, onPreviousTurn, role, onAddCharacter, onToggleVisibility, onCharacterClick }: GameSidebarProps) {
  const currentCharacter = characters.find(c => c.id === currentTurnId);
  return (
    <Sidebar>
      <SidebarHeader>
        <h2 className="text-lg font-semibold font-headline">Controlli di Gioco</h2>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-0">
        <ScrollArea className="h-full">
            <SidebarGroup>
                <SidebarGroupLabel>Ordine di Turno</SidebarGroupLabel>
                <TurnTracker
                  characters={characters}
                  currentTurnId={currentTurnId}
                  onInitiativeChange={onInitiativeChange}
                  onToggleVisibility={onToggleVisibility}
                  onCharacterClick={onCharacterClick}
                  role={role}
                />
            </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
      {role === 'master' && (
        <div className="flex flex-col gap-2 border-t p-4">
          {currentCharacter && <div className='text-center text-sm text-muted-foreground pb-2'>È il turno di: <span className='font-bold text-foreground'>{currentCharacter.name}</span></div>}
          <div className="flex gap-2">
              <Button onClick={onPreviousTurn} variant="outline" size="icon" aria-label="Turno Precedente">
                  <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button onClick={onNextTurn} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Prossimo Turno <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </div>
          <Separator className='my-2'/>
          <Button onClick={onAddCharacter} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi Personaggio
          </Button>
        </div>
      )}
    </Sidebar>
  );
}
