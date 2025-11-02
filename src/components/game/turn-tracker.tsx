import React, { useState, useEffect, useRef } from 'react';
import type { Character } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameIcon } from './icons';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Shield, Heart } from 'lucide-react';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InitiativeInputProps {
  characterId: string;
  initialValue: number;
  onInitiativeChange: (characterId: string, initiative: number) => Promise<void>;
  isPlayer: boolean;
}

function InitiativeInput({ characterId, initialValue, onInitiativeChange, isPlayer }: InitiativeInputProps) {
  const [value, setValue] = useState(initialValue.toString());
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update local state if the character data from server changes
    setValue(initialValue.toString());
  }, [initialValue]);

  const triggerUpdate = (newValue: number) => {
    if (newValue !== initialValue) {
      onInitiativeChange(characterId, newValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      const numericValue = parseInt(e.target.value, 10);
      if (!isNaN(numericValue)) {
        triggerUpdate(numericValue);
      }
    }, 800); // 800ms debounce delay
  };

  const handleBlur = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      triggerUpdate(numericValue);
    } else {
      // If input is invalid, revert to initial value
      setValue(initialValue.toString());
    }
  };
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }

  return (
    <Input
      type="number"
      id={`initiative-${characterId}`}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className="w-16 h-8 text-center [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      aria-label={`${characterId} initiative`}
      placeholder="Init."
      readOnly={isPlayer}
    />
  );
}


interface TurnTrackerProps {
  characters: Character[];
  currentTurnId: string | null;
  onInitiativeChange: (characterId: string, initiative: number) => Promise<void>;
  onToggleVisibility: (characterId: string, isVisible: boolean) => void;
  onCharacterClick: (characterId: string) => void;
  role: 'master' | 'player' | 'group';
}

export function TurnTracker({ characters, currentTurnId, onInitiativeChange, role, onToggleVisibility, onCharacterClick }: TurnTrackerProps) {
  const isPlayer = role === 'player' || role === 'group';
  
  return (
    <div className="flex flex-col gap-4 p-2">
        <ul className="space-y-3">
          <TooltipProvider>
            {characters.map((char) => (
              <li
                key={char.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg transition-all relative overflow-hidden',
                  char.id === currentTurnId ? 'bg-primary/20 ring-2 ring-primary' : 'bg-sidebar-accent',
                   role === 'master' && !char.isVisibleToPlayers && 'opacity-60',
                  role === 'master' && 'cursor-pointer hover:bg-sidebar-accent/80'
                )}
                onClick={() => role === 'master' && onCharacterClick(char.id)}
              >
                 <div className="absolute bottom-0 left-0 h-1 w-full bg-red-800/50">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300" 
                      style={{ width: `${Math.max(0, (char.currentHp / char.maxHp) * 100)}%` }} 
                    />
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full overflow-hidden w-9 h-9 flex items-center justify-center" style={{ backgroundColor: char.icon.type === 'image' ? 'transparent' : char.color }}>
                     {char.icon.type === 'icon' ? (
                      <GameIcon name={char.icon.name} className="h-5 w-5 text-white" />
                    ) : (
                      <Image src={char.icon.url} alt={char.name} width={36} height={36} className="object-cover w-full h-full" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold">{char.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500" />
                            <span>{char.currentHp}/{char.maxHp}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-blue-500" />
                            <span>{char.armorClass}</span>
                        </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {role === 'master' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility(char.id, !char.isVisibleToPlayers)
                          }}
                          className="h-8 w-8"
                          aria-label={char.isVisibleToPlayers ? 'Nascondi ai giocatori' : 'Mostra ai giocatori'}
                        >
                          {char.isVisibleToPlayers ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {char.isVisibleToPlayers ? 'Nascondi ai giocatori' : 'Mostra ai giocatori'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {role === 'master' ? (
                    <InitiativeInput
                        characterId={char.id}
                        initialValue={char.initiative}
                        onInitiativeChange={onInitiativeChange}
                        isPlayer={isPlayer}
                    />
                  ) : (
                     <div className="w-16 h-8 flex items-center justify-center font-bold text-lg">
                        {char.initiative}
                     </div>
                  )}
                </div>
              </li>
            ))}
          </TooltipProvider>
      </ul>
    </div>
  );
}
