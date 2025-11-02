import React from 'react';
import type { Character } from '@/lib/types';
import { GameIcon } from './icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CharacterTokenProps {
  character: Character;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  role: 'master' | 'player' | 'group';
}

export function CharacterToken({ character, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, isDragging, role }: CharacterTokenProps) {
  const isPlayerView = role === 'player' || role === 'group';

  // In player view (single or group), only player characters are always visible (z-20)
  // NPCs are placed at z-0, so they are hidden by the Fog of War (z-10) until revealed.
  // In master view, all tokens are visible on top (z-20).
  const zIndexClass = (!isPlayerView || character.isPlayerCharacter) ? 'z-20' : 'z-0';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer select-none ring-2 ring-offset-2 ring-offset-black/50 overflow-hidden',
              isDragging ? 'scale-110 shadow-2xl z-30' : 'transition-all duration-300 ease-in-out',
              character.playerId && 'ring-yellow-400',
              zIndexClass,
            )}
            style={{
              left: `${character.position.x}px`,
              top: `${character.position.y}px`,
              backgroundColor: character.icon.type === 'image' ? 'transparent' : character.color,
              borderColor: 'rgba(255, 255, 255, 0.7)',
              boxShadow: character.icon.type === 'image' ? `0 0 8px rgba(255,255,255,0.8)` : `0 0 10px ${character.color}, 0 0 20px ${character.color}`,
            }}
            aria-label={`Character token for ${character.name}`}
          >
            {character.icon.type === 'icon' ? (
              <GameIcon name={character.icon.name} className="w-6 h-6 text-white" />
            ) : (
              <Image 
                src={character.icon.url} 
                alt={character.name} 
                width={40} 
                height={40} 
                className="object-cover w-full h-full"
                draggable="false"
                onDragStart={(e) => e.preventDefault()}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{character.name}</p>
          {character.playerId && <p className="text-xs text-muted-foreground">(Giocatore connesso)</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
