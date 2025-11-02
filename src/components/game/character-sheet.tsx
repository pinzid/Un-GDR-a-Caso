'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Character } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GameIcon, iconMap } from './icons';
import { DRAW_COLORS } from '@/lib/colors';
import { ImagePlus, Trash2, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterSheetProps {
  character: Character;
  onUpdate: (character: Character) => void;
  onDelete: (characterId: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function CharacterSheet({ character, onUpdate, onDelete, onOpenChange }: CharacterSheetProps) {
  const [editedChar, setEditedChar] = useState<Character>(character);
  const [isIconUploading, setIsIconUploading] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setEditedChar(character);
  }, [character]);

  const handleIconUploadClick = () => {
    iconInputRef.current?.click();
  };

  const handleIconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsIconUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setEditedChar(c => ({ ...c, icon: { type: 'image', url: result } }));
        }
        setIsIconUploading(false);
      };
      reader.onerror = () => {
        setIsIconUploading(false);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile leggere il file dell\'icona.'});
      }
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = () => {
    onUpdate(editedChar);
  };
  
  const handleDelete = () => {
    onDelete(character.id);
  }

  return (
    <Dialog open={!!character} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Scheda Personaggio: {character.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="char-name" className="text-right">Nome</Label>
            <Input
              id="char-name"
              value={editedChar.name}
              onChange={(e) => setEditedChar({ ...editedChar, name: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="char-hp" className="text-right">Punti Vita</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="char-hp"
                type="number"
                value={editedChar.currentHp}
                onChange={(e) => setEditedChar({ ...editedChar, currentHp: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
              <span className="text-muted-foreground">/</span>
              <Input
                id="char-max-hp"
                type="number"
                value={editedChar.maxHp}
                onChange={(e) => setEditedChar({ ...editedChar, maxHp: parseInt(e.target.value) || 0 })}
                className="w-20"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="char-ac" className="text-right">Classe Armatura</Label>
            <Input
              id="char-ac"
              type="number"
              value={editedChar.armorClass}
              onChange={(e) => setEditedChar({ ...editedChar, armorClass: parseInt(e.target.value) || 0 })}
              className="col-span-3"
            />
          </div>
           <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Colore</Label>
                 <div className="col-span-3 grid grid-cols-5 gap-2">
                    {DRAW_COLORS.map(color => (
                        <Button
                            key={color}
                            variant={editedChar.color === color ? "default" : "outline"}
                            size="icon"
                            style={{ backgroundColor: color, border: '1px solid hsl(var(--border))' }}
                            onClick={() => setEditedChar({...editedChar, color: color})}
                            aria-label={color}
                        />
                    ))}
                </div>
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Icona</Label>
                <div className="col-span-3">
                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="grid grid-cols-6 gap-2">
                        {Object.keys(iconMap).map(iconKey => (
                            <Button
                                key={iconKey}
                                variant={editedChar.icon.type === 'icon' && editedChar.icon.name === iconKey ? "default" : "outline"}
                                size="icon"
                                onClick={() => setEditedChar({...editedChar, icon: {type: 'icon', name: iconKey as keyof typeof iconMap}})}
                                className="aspect-square w-full h-auto"
                            >
                                <GameIcon name={iconKey as keyof typeof iconMap} className="w-5 h-5" />
                            </Button>
                        ))}
                    </div>
                  </ScrollArea>
                   <Button variant="outline" className="w-full mt-2" onClick={handleIconUploadClick} disabled={isIconUploading}>
                      {isIconUploading ? (
                          <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              Caricamento...
                          </>
                      ) : (
                          <>
                              <ImagePlus className="mr-2 h-4 w-4" />
                              Carica Immagine
                          </>
                      )}
                  </Button>
                  <input
                    type="file"
                    ref={iconInputRef}
                    onChange={handleIconFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
            </div>
        </div>
        <DialogFooter className='justify-between'>
            <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4"/> Rimuovi
            </Button>
          <Button onClick={handleSaveChanges}>Salva Modifiche</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
