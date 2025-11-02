'use client';

import React, { useState } from 'react';
import type { Character } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus } from 'lucide-react';

interface QuickHpChangerProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

export function QuickHpChanger({ character, onUpdate }: QuickHpChangerProps) {
  const [amount, setAmount] = useState(1);

  const handleApply = (modifier: 'damage' | 'heal') => {
    const newHp = modifier === 'damage' 
      ? Math.max(0, character.currentHp - amount) 
      : Math.min(character.maxHp, character.currentHp + amount);
      
    onUpdate({ ...character, currentHp: newHp });
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-background rounded-lg shadow-lg">
      <p className="text-center font-semibold text-foreground">{character.name}</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
          className="w-20 text-center"
          aria-label="Amount to heal or damage"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
                handleApply('damage'); // Default to damage on enter
            }
          }}
        />
        <div className="flex flex-col gap-1">
          <Button onClick={() => handleApply('damage')} size="sm" variant="destructive" className="h-7">
            Danno
          </Button>
          <Button onClick={() => handleApply('heal')} size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-white">
            Cura
          </Button>
        </div>
      </div>
    </div>
  );
}
