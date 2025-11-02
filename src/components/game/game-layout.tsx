'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { GameSidebar } from './game-sidebar';
import { MapArea } from './map-area';
import type { Character, RevealedArea, GameState, Drawing, NamedSave } from '@/lib/types';
import { Dices, Save, FolderOpen, Share2, Upload, PlusCircle, Hand, ImagePlus, Menu, Trash2, Users, Loader, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { GameIcon, iconMap } from './icons';
import placeholderData from '@/lib/placeholder-images.json';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CharacterSheet } from './character-sheet';
import { 
    getGameState, 
    updateCharacter,
    updateRevealedAreas, 
    nextTurn,
    previousTurn,
    sortCharacters, 
    setMapImage as setServerMapImage, 
    replaceGameState, 
    selectCharacter, 
    releaseCharacter,
    addCharacter as addServerCharacter,
    updateCharacterVisibility as updateServerCharacterVisibility,
    updateDrawings,
    removeCharacter,
    resetForNewMap
} from '@/app/game/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DRAW_COLORS } from '@/lib/colors';
import { ScrollArea } from '../ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { QuickHpChanger } from './quick-hp-changer';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

interface GameLayoutProps {
  role: 'master' | 'player' | 'group';
}

const QUICK_SAVES_KEY = 'gdr-game-saves';
const NAMED_SAVES_KEY = 'gdr-named-saves';
const LATEST_GAME_STATE_KEY = 'gdr-latest-game-state';

const MAX_QUICK_SAVES = 5;
const PLAYER_CHAR_KEY = 'gdr-player-char-id';
const TAP_THRESHOLD_MS = 200; // Milliseconds to distinguish a tap from a hold
const TAP_MOVEMENT_THRESHOLD = 5; // Pixels a user can move and still be a tap

const fetcher = () => getGameState();

const initialNewCharState: Omit<Character, 'id' | 'position' | 'initiative' | 'playerId' | 'isVisibleToPlayers'> = {
  name: '',
  icon: { type: 'icon', name: 'UserRound' },
  color: '#FF0000',
  maxHp: 10,
  currentHp: 10,
  armorClass: 10,
  isPlayerCharacter: false,
};


export function GameLayout({ role }: GameLayoutProps) {
  const { data: gameState, mutate } = useSWR('gameState', fetcher, {
    refreshInterval: 2000,
  });
  
  const router = useRouter();
  const [draggingCharacterId, setDraggingCharacterId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [startDragPos, setStartDragPos] = useState<{x: number, y: number} | null>(null);
  const [currentDragPos, setCurrentDragPos] = useState<{x: number, y: number} | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const charIconInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [quickSaves, setQuickSaves] = useState<GameState[]>([]);
  const [namedSaves, setNamedSaves] = useState<NamedSave[]>([]);

  const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  const [isNewMapDialogOpen, setIsNewMapDialogOpen] = useState(false);
  const [newMapCharacterIds, setNewMapCharacterIds] = useState<Record<string, boolean>>({});

  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null);
  const [isCharacterSelectOpen, setIsCharacterSelectOpen] = useState(false);

  const [viewState, setViewState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });

  const [isAddCharDialogOpen, setIsAddCharDialogOpen] = useState(false);
  const [newChar, setNewChar] = useState(initialNewCharState);

  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [hpChangerState, setHpChangerState] = useState<{character: Character} | null>(null);
  const touchStartRef = useRef<{ time: number, pos: {x: number, y: number} } | null>(null);

  const [isMapUploading, setIsMapUploading] = useState(false);
  const [isIconUploading, setIsIconUploading] = useState(false);

  const charactersForUi = gameState?.characters || [];
  const allCharactersForMap = gameState?.allCharacters || gameState?.characters || [];
  const revealedAreas = gameState?.revealedAreas || [];
  const drawings = gameState?.drawings || [];
  const currentTurnId = gameState?.currentTurnId || null;
  const mapImage = gameState?.mapImage || placeholderData.placeholderImages[0];
  const playerCharacter = allCharactersForMap.find(c => c.id === playerCharacterId);

  const getMapCoordinates = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | Touch) => {
      const mapEl = mapRef.current;
      if (!mapEl) return { x: 0, y: 0 };
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const mapRect = mapEl.getBoundingClientRect();
      const x = (clientX - mapRect.left - viewState.pan.x) / viewState.zoom;
      const y = (clientY - mapRect.top - viewState.pan.y) / viewState.zoom;
      return { x, y };
    };

    useEffect(() => {
        if (role === 'master') {
            const handleBeforeUnload = () => {
                if (gameState) {
                    try {
                        const stateToSave = { ...gameState, timestamp: new Date().toISOString() };
                        localStorage.setItem(LATEST_GAME_STATE_KEY, JSON.stringify(stateToSave));
                        replaceGameState(stateToSave); // Also save to server file
                    } catch (e) {
                        console.error("Impossibile salvare lo stato di gioco:", e);
                    }
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [gameState, role]);

  useEffect(() => {
    if (role === 'player') {
        const savedCharId = sessionStorage.getItem(PLAYER_CHAR_KEY);
        if (savedCharId && allCharactersForMap.find(c => c.id === savedCharId)) {
            setPlayerCharacterId(savedCharId);
            setIsCharacterSelectOpen(false);
        } else if (allCharactersForMap.some(c => c.isPlayerCharacter)) { 
            setIsCharacterSelectOpen(true);
        }
    }
  }, [role, allCharactersForMap]);


  useEffect(() => {
    const handleBeforeUnload = () => {
        if (role === 'player' && playerCharacterId) {
            navigator.sendBeacon('/api/release-character', JSON.stringify({ characterId: playerCharacterId }));
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [playerCharacterId, role]);

  const handleInitiativeChange = useCallback(async (characterId: string, initiative: number) => {
    if (role !== 'master' || !gameState) return;
    const characterToUpdate = allCharactersForMap.find(c => c.id === characterId);
    if (characterToUpdate) {
        await updateCharacter({ ...characterToUpdate, initiative });
        await sortCharacters();
        mutate();
    }
  }, [allCharactersForMap, gameState, mutate, role]);


  const handleNextTurn = useCallback(async () => {
    if (role !== 'master' || !gameState) return;
    const nextCharacter = await nextTurn();
    mutate();
    if(nextCharacter) {
      toast({
        title: "Prossimo Turno",
        description: `È il turno di ${nextCharacter.name}.`,
      });
    }
  }, [gameState, toast, mutate, role]);
  
  const handlePreviousTurn = useCallback(async () => {
    if (role !== 'master' || !gameState) return;
    const prevCharacter = await previousTurn();
    mutate();
     if(prevCharacter) {
      toast({
        title: "Turno Precedente",
        description: `È il turno di ${prevCharacter.name}.`,
      });
    }
  }, [gameState, toast, mutate, role]);

  const handleDragStart = (characterId: string, startPos: {x: number, y: number}) => {
    setHpChangerState(null);
    const characterToMove = allCharactersForMap.find(c => c.id === characterId);
    if (!characterToMove || !mapRef.current) return;

    const isMaster = role === 'master';
    const isPlayerTurn = role === 'player' && characterId === currentTurnId && playerCharacterId === characterId;
    const isGroupTurn = role === 'group' && characterId === currentTurnId && characterToMove.isPlayerCharacter;

    if (isMaster || isPlayerTurn || isGroupTurn) {
      setDraggingCharacterId(characterId);
      setStartDragPos(startPos);
      setCurrentDragPos(startPos);
    } else if (role !== 'master') {
        toast({
            variant: 'destructive',
            title: 'Non è il tuo turno!',
            description: "Puoi muovere il tuo personaggio solo durante il suo turno."
        })
    }
  };

  const handleMouseDownOnToken = (e: React.MouseEvent<HTMLDivElement>, characterId: string) => {
    touchStartRef.current = { time: Date.now(), pos: {x: e.clientX, y: e.clientY} };
    handleDragStart(characterId, getMapCoordinates(e));
  };
  
  const handleTouchStartOnToken = (e: React.TouchEvent<HTMLDivElement>, characterId: string) => {
    e.stopPropagation(); 
    touchStartRef.current = { time: Date.now(), pos: {x: e.touches[0].clientX, y: e.touches[0].clientY} };
    handleDragStart(characterId, getMapCoordinates(e.touches[0]));
  };
  
  const handleTapOnToken = (characterId: string) => {
    if (role !== 'master') return;
    const character = allCharactersForMap.find(c => c.id === characterId);
    if (character) {
      setHpChangerState({ character });
      setDraggingCharacterId(null);
      setStartDragPos(null);
      setCurrentDragPos(null);
    }
  };

  const handleTouchEndOnToken = (e: React.TouchEvent<HTMLDivElement>, characterId: string) => {
    if (touchStartRef.current) {
      const touchDuration = Date.now() - touchStartRef.current.time;
      const movedX = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.pos.x);
      const movedY = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.pos.y);
      const moved = Math.sqrt(movedX * movedX + movedY * movedY);

      if (touchDuration < TAP_THRESHOLD_MS && moved < TAP_MOVEMENT_THRESHOLD) {
        e.preventDefault();
        handleTapOnToken(characterId);
      }
    }
    touchStartRef.current = null;
    handleDragEnd(null, null);
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!mapRef.current || (!draggingCharacterId && !isMeasuring) || !gameState) return;
    
    const coords = getMapCoordinates('touches' in e ? e.touches[0] : e);
    setCurrentDragPos(coords);

    if (draggingCharacterId) {
      const updatedCharacters = allCharactersForMap.map((char) =>
          char.id === draggingCharacterId ? { ...char, position: coords } : char
      );
      const optimisticState = { ...gameState, allCharacters: updatedCharacters, characters: updatedCharacters };
      mutate(optimisticState, false);
    }
  };

  const handleDragEnd = async (e: React.MouseEvent<HTMLDivElement> | null, characterId: string | null) => {
    if (touchStartRef.current && e && characterId) {
      const touchDuration = Date.now() - touchStartRef.current.time;
      const movedX = Math.abs(e.clientX - touchStartRef.current.pos.x);
      const movedY = Math.abs(e.clientY - touchStartRef.current.pos.y);
      const moved = Math.sqrt(movedX * movedX + movedY * movedY);

      if (touchDuration < TAP_THRESHOLD_MS && moved < TAP_MOVEMENT_THRESHOLD) {
        handleTapOnToken(characterId);
        touchStartRef.current = null;
        return;
      }
    }
    touchStartRef.current = null;

    if (draggingCharacterId && gameState && currentDragPos) {
      const characterToUpdate = allCharactersForMap.find(c => c.id === draggingCharacterId);
      if (characterToUpdate) {
        await updateCharacter({ ...characterToUpdate, position: { ...currentDragPos } });
        mutate();
      }
    }
    setDraggingCharacterId(null);
    if (!isMeasuring) {
      setStartDragPos(null);
      setCurrentDragPos(null);
    }
  };
  
  const handleMouseLeaveMap = async () => {
     if (draggingCharacterId) {
       await handleDragEnd(null, null);
    }
  };

  const handleRevealedAreasChange = useCallback(async (newAreas: RevealedArea | RevealedArea[]) => {
    if (role !== 'master' || !gameState) return;

    let finalAreas: RevealedArea[];
    if (Array.isArray(newAreas)) {
        finalAreas = newAreas;
    } else {
        finalAreas = [...(gameState.revealedAreas || []), newAreas];
    }
    
    await updateRevealedAreas(finalAreas);
    mutate();
  }, [gameState, mutate, role]);


  const handleDrawingsChange = useCallback(async (newDrawings: Drawing[] | ((d: Drawing[]) => Drawing[])) => {
    if (!gameState) return;

    const finalDrawings = typeof newDrawings === 'function' 
        ? newDrawings(gameState.drawings || [])
        : newDrawings;

    await updateDrawings(finalDrawings);
    mutate();
  }, [gameState, mutate]);

  const handleMapUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsMapUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const newMapImage = {
            id: 'custom-map',
            imageUrl: result,
            description: file.name,
            imageHint: 'custom map'
          };
          await setServerMapImage(newMapImage);
          setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
          mutate();
        }
        setIsMapUploading(false);
      };
       reader.onerror = () => {
        setIsMapUploading(false);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile leggere il file della mappa.'});
      }
      reader.readAsDataURL(file);
    }
  };

  const handleQuickSave = () => {
    if (!gameState) return;
    try {
      const currentGameState = {
        ...gameState,
        timestamp: new Date().toISOString(),
      };
      
      const savedStatesJSON = localStorage.getItem(QUICK_SAVES_KEY);
      let savedStates: GameState[] = savedStatesJSON ? JSON.parse(savedStatesJSON) : [];
      
      savedStates.unshift(currentGameState);
      const newSavedStates = savedStates.slice(0, MAX_QUICK_SAVES);
      
      localStorage.setItem(QUICK_SAVES_KEY, JSON.stringify(newSavedStates));
      replaceGameState(currentGameState); // Also save to server file
      
      toast({
        title: 'Stato del gioco salvato',
        description: `Salvataggio rapido creato alle ${new Date(currentGameState.timestamp).toLocaleTimeString()}.`,
      });
    } catch (error) {
      console.error("Errore nel salvataggio rapido:", error);
      toast({
        variant: "destructive",
        title: 'Errore nel salvataggio',
        description: 'Impossibile salvare lo stato del gioco.',
      });
    }
  };
  
  const handleSaveAs = () => {
    if (!gameState || !saveAsName) return;
    try {
      const currentNamedSavesJSON = localStorage.getItem(NAMED_SAVES_KEY);
      const currentNamedSaves: NamedSave[] = currentNamedSavesJSON ? JSON.parse(currentNamedSavesJSON) : [];

      const newSave: NamedSave = {
        name: saveAsName,
        state: { ...gameState, timestamp: new Date().toISOString() }
      };

      const newNamedSaves = [...currentNamedSaves.filter(s => s.name !== saveAsName), newSave];
      localStorage.setItem(NAMED_SAVES_KEY, JSON.stringify(newNamedSaves));

      replaceGameState(newSave.state); // Also save to server file
      toast({
        title: 'Salvataggio completato',
        description: `Stato salvato come "${saveAsName}".`
      });
      setIsSaveAsDialogOpen(false);
      setSaveAsName('');
    } catch(error) {
      console.error("Errore salvando con nome:", error);
      toast({ variant: 'destructive', title: 'Errore nel salvataggio', description: 'Impossibile salvare lo stato.' });
    }
  };


  const handleOpenLoadDialog = () => {
    try {
      const quickSavesJson = localStorage.getItem(QUICK_SAVES_KEY);
      const namedSavesJson = localStorage.getItem(NAMED_SAVES_KEY);
      
      setQuickSaves(quickSavesJson ? JSON.parse(quickSavesJson) : []);
      setNamedSaves(namedSavesJson ? JSON.parse(namedSavesJson) : []);
      
      setIsLoadDialogOpen(true);
    } catch (error) {
      console.error("Errore nel caricamento dei salvataggi:", error);
      toast({
        variant: "destructive",
        title: 'Errore nel caricamento',
        description: 'Impossibile leggere i file di salvataggio.',
      });
    }
  };

  const loadState = (stateToLoad: GameState) => {
    const newState = { ...stateToLoad, version: Date.now() };
    mutate(newState, false);
    replaceGameState(newState).then(() => mutate());

    setIsLoadDialogOpen(false);
    toast({
      title: 'Stato del gioco caricato',
      description: `Ripristinato il salvataggio delle ${new Date(stateToLoad.timestamp).toLocaleString()}.`,
    });
  };

  const deleteNamedSave = (saveName: string) => {
    const currentNamedSaves: NamedSave[] = JSON.parse(localStorage.getItem(NAMED_SAVES_KEY) || '[]');
    const newNamedSaves = currentNamedSaves.filter(s => s.name !== saveName);
    localStorage.setItem(NAMED_SAVES_KEY, JSON.stringify(newNamedSaves));
    setNamedSaves(newNamedSaves); // Update state to re-render dialog
    toast({
      variant: 'destructive',
      title: 'Salvataggio eliminato',
      description: `Il salvataggio "${saveName}" è stato rimosso.`
    });
  };

  const handleShare = () => {
    const playerLink = `${window.location.origin}${window.location.pathname}?role=player`;
    navigator.clipboard.writeText(playerLink).then(() => {
      toast({
        title: 'Link copiato!',
        description: 'Il link di invito per i giocatori è stato copiato negli appunti.',
      });
    }).catch(() => {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile copiare il link negli appunti.',
      });
    });
  };

  const handleSelectCharacter = async (characterId: string) => {
    const success = await selectCharacter(characterId);
    if (success) {
        setPlayerCharacterId(characterId);
        sessionStorage.setItem(PLAYER_CHAR_KEY, characterId);
        setIsCharacterSelectOpen(false);
        const char = allCharactersForMap.find(c => c.id === characterId);
        toast({
            title: "Personaggio selezionato!",
            description: `Ora sei ${char?.name}.`
        });
    } else {
        toast({
            variant: "destructive",
            title: "Personaggio già preso",
            description: "Questo personaggio è già stato scelto da un altro giocatore."
        });
    }
    mutate();
  };

  const handleChangeCharacter = async () => {
    if (playerCharacterId) {
        await releaseCharacter(playerCharacterId);
        sessionStorage.removeItem(PLAYER_CHAR_KEY);
        setPlayerCharacterId(null);
        setIsCharacterSelectOpen(true);
        mutate();
    }
  }

  const handleCharacterSelectOpenChange = (open: boolean) => {
    if (!open && !playerCharacterId) {
      router.push('/');
    } else {
      setIsCharacterSelectOpen(open);
    }
  };

  const handleAddChar = async () => {
      if (!newChar.name) {
          toast({ variant: 'destructive', title: 'Nome richiesto', description: 'Inserisci un nome per il personaggio.'});
          return;
      }
      await addServerCharacter(newChar);
      setNewChar(initialNewCharState);
      setIsAddCharDialogOpen(false);
      toast({ title: 'Personaggio Aggiunto', description: `${newChar.name} è stato aggiunto alla partita.`});
      mutate();
  }

  const handleToggleVisibility = useCallback(async (characterId: string, isVisible: boolean) => {
    if (role !== 'master') return;
    await updateServerCharacterVisibility(characterId, isVisible);
    mutate();
  }, [role, mutate]);
  
  const handleOpenCharacterSheet = useCallback((characterId: string) => {
    if (role === 'master') {
        const char = allCharactersForMap.find(c => c.id === characterId);
        if (char) {
            setHpChangerState(null);
            setEditingCharacter(char);
        }
    }
  }, [role, allCharactersForMap]);

  const handleCharacterUpdate = useCallback(async (updatedCharacter: Character) => {
    await updateCharacter(updatedCharacter);
    setEditingCharacter(null);
    setHpChangerState(null);
    mutate();
    toast({
        title: 'Personaggio Aggiornato',
        description: `${updatedCharacter.name} è stato aggiornato.`
    })
  }, [mutate, toast]);
  
  const handleCharacterDelete = useCallback(async (characterId: string) => {
    const characterToDelete = allCharactersForMap.find(c => c.id === characterId);
    await removeCharacter(characterId);
    setEditingCharacter(null);
    mutate();
    toast({
        variant: 'destructive',
        title: 'Personaggio Rimosso',
        description: `${characterToDelete?.name} è stato rimosso dalla partita.`
    })
  }, [allCharactersForMap, mutate, toast]);

    const handleMouseDownOnMap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMeasuring && mapRef.current) {
        const coords = getMapCoordinates(e);
        setStartDragPos(coords);
        setCurrentDragPos(coords);
    }
  };
  
    const handleTouchStartOnMap = (e: React.TouchEvent<HTMLDivElement>) => {
        if (isMeasuring && mapRef.current) {
            const coords = getMapCoordinates(e.touches[0]);
            setStartDragPos(coords);
            setCurrentDragPos(coords);
        }
    };

  const handleCharIconUploadClick = () => {
    charIconInputRef.current?.click();
  };

  const handleCharIconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsIconUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setNewChar(char => ({ ...char, icon: { type: 'image', url: result } }));
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

  const handleOpenNewMapDialog = () => {
    setNewMapCharacterIds(
      allCharactersForMap.reduce((acc, char) => {
        acc[char.id] = char.isPlayerCharacter; // Pre-select player characters
        return acc;
      }, {} as Record<string, boolean>)
    );
    setIsNewMapDialogOpen(true);
  };
  
  const handleCreateNewMap = async () => {
    const selectedIds = Object.keys(newMapCharacterIds).filter(id => newMapCharacterIds[id]);
    if (selectedIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nessun personaggio selezionato',
        description: 'Seleziona almeno un personaggio da portare nella nuova mappa.',
      });
      return;
    }

    await resetForNewMap(selectedIds);
    setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
    mutate();
    setIsNewMapDialogOpen(false);
    toast({
      title: 'Nuova Mappa Creata',
      description: 'Lo stato di gioco è stato resettato. Carica una nuova immagine per la mappa.',
    });
  };
  
  if (!gameState) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
            <Dices className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-xl">Caricamento della partita...</p>
        </div>
    )
  }

  const showGame = role === 'master' || role === 'group' || (role === 'player' && playerCharacterId);

  return (
    <>
    {showGame ? (
      <SidebarProvider>
        <GameSidebar
          characters={charactersForUi}
          currentTurnId={currentTurnId}
          onInitiativeChange={handleInitiativeChange}
          onNextTurn={handleNextTurn}
          onPreviousTurn={handlePreviousTurn}
          onAddCharacter={() => setIsAddCharDialogOpen(true)}
          onToggleVisibility={handleToggleVisibility}
          onCharacterClick={handleOpenCharacterSheet}
          role={role}
        />
        <SidebarInset>
          <header className="flex items-center justify-between p-2 md:p-4 border-b flex-wrap">
            <div className="flex items-center gap-2 md:gap-4">
              <SidebarTrigger />
              <h1 className="font-headline text-xl md:text-2xl text-accent flex items-center gap-2">
                <Dices className="text-primary hidden md:block" />
                Un GDR a caso
              </h1>
            </div>
            <div className="flex items-center gap-2">
            {role === 'master' && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Menu />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleShare}>
                            <Share2 className="mr-2 h-4 w-4" />
                            <span>Invita Giocatori</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleQuickSave}>
                            <Save className="mr-2 h-4 w-4" />
                            <span>Salvataggio Rapido</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsSaveAsDialogOpen(true)}>
                            <Save className="mr-2 h-4 w-4" />
                            <span>Salva con nome...</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleOpenLoadDialog}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            <span>Carica Partita</span>
                        </DropdownMenuItem>
                         <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleMapUploadClick} disabled={isMapUploading}>
                             {isMapUploading ? (
                                <>
                                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    <span>Caricamento...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    <span>Carica Mappa</span>
                                </>
                            )}
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleOpenNewMapDialog}>
                            <Map className="mr-2 h-4 w-4" />
                            <span>Nuova Mappa</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {role === 'player' && playerCharacter && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs md:text-sm p-2 border rounded-md">
                        {playerCharacter.icon.type === 'icon' ? (
                          <GameIcon name={playerCharacter.icon.name} className="h-5 w-5" style={{ color: playerCharacter?.color }}/>
                        ) : (
                           <div className="w-5 h-5 rounded-full overflow-hidden" style={{ backgroundColor: playerCharacter?.color }}>
                              <img src={playerCharacter.icon.url} alt="icon" className="w-full h-full object-cover" />
                           </div>
                        )}
                        <span className="hidden sm:inline">{playerCharacter?.name}</span>
                    </div>
                    <Button variant="outline" onClick={handleChangeCharacter} size="sm">
                        Cambia
                    </Button>
                </div>
            )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </header>
          <MapArea
            ref={mapRef}
            characters={allCharactersForMap}
            revealedAreas={revealedAreas}
            setRevealedAreas={handleRevealedAreasChange}
            drawings={drawings || []}
            setDrawings={handleDrawingsChange}
            mapImage={mapImage}
            onMouseDownOnToken={handleMouseDownOnToken}
            onTouchStartOnToken={handleTouchStartOnToken}
            onMouseUpOnToken={handleDragEnd}
            onTouchEndOnToken={handleTouchEndOnToken}
            onMouseDownOnMap={handleMouseDownOnMap}
            onTouchStartOnMap={handleTouchStartOnMap}
            onMouseMove={handleDragMove}
            onMouseUp={() => {
              handleDragEnd(null, null);
              if (isMeasuring) {
                setIsMeasuring(false);
                setStartDragPos(null);
                setCurrentDragPos(null);
              }
            }}
            onMouseLeave={handleMouseLeaveMap}
            onTouchMove={handleDragMove}
            onTouchEnd={() => {
                handleDragEnd(null, null);
                if (isMeasuring) {
                    setIsMeasuring(false);
                    setStartDragPos(null);
                    setCurrentDragPos(null);
                }
            }}
            draggingCharacterId={draggingCharacterId}
            startDragPos={startDragPos}
            currentDragPos={currentDragPos}
            isMeasuring={isMeasuring}
            setIsMeasuring={setIsMeasuring}
            role={role}
            viewState={viewState}
            setViewState={setViewState}
          />
        </SidebarInset>
      </SidebarProvider>
      ) : (
         <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground p-4 text-center">
            <Dices className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-xl">In attesa della selezione del personaggio...</p>
        </div>
      )}

      {editingCharacter && (
        <CharacterSheet
            character={editingCharacter}
            onUpdate={handleCharacterUpdate}
            onDelete={handleCharacterDelete}
            onOpenChange={(isOpen) => !isOpen && setEditingCharacter(null)}
        />
      )}

      {role === 'master' && hpChangerState && (
          <Popover open={!!hpChangerState} onOpenChange={() => setHpChangerState(null)}>
              <PopoverTrigger asChild>
                  <div 
                      className="absolute" 
                      style={{
                          left: `${(hpChangerState.character.position.x * viewState.zoom) + viewState.pan.x}px`,
                          top: `${(hpChangerState.character.position.y * viewState.zoom) + viewState.pan.y}px`,
                      }}
                  />
              </PopoverTrigger>
              <PopoverContent className="w-auto" side="top" align="center">
                  <QuickHpChanger 
                      character={hpChangerState.character}
                      onUpdate={handleCharacterUpdate}
                  />
              </PopoverContent>
          </Popover>
      )}

      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carica Partita</DialogTitle>
            <DialogDescription>
              Seleziona un salvataggio da ripristinare.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-4 p-1">
                {namedSaves.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2 px-2">Salvataggi Nominati</h3>
                        <div className="flex flex-col gap-2">
                        {namedSaves.sort((a,b) => new Date(b.state.timestamp).getTime() - new Date(a.state.timestamp).getTime()).map((save) => (
                            <div key={save.name} className="flex items-center gap-2 group">
                                <Button
                                    variant="outline"
                                    className="justify-start flex-1"
                                    onClick={() => loadState(save.state)}
                                >
                                    <div className='flex justify-between w-full'>
                                        <span>{save.name}</span>
                                        <span className='text-muted-foreground text-xs'>{new Date(save.state.timestamp).toLocaleString()}</span>
                                    </div>
                                </Button>
                                <Button variant="ghost" size="icon" className='h-8 w-8 opacity-0 group-hover:opacity-100' onClick={() => deleteNamedSave(save.name)}>
                                    <Trash2 className="text-destructive"/>
                                </Button>
                             </div>
                        ))}
                        </div>
                    </div>
                )}
                
                {(namedSaves.length > 0 && quickSaves.length > 0) && <Separator className="my-4"/>}

                {quickSaves.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold mb-2 px-2">Salvataggi Rapidi</h3>
                        <div className="flex flex-col gap-2">
                        {quickSaves.map((game) => (
                            <Button
                                key={game.timestamp}
                                variant="outline"
                                className="justify-start"
                                onClick={() => loadState(game)}
                            >
                                Salvataggio del {new Date(game.timestamp).toLocaleString()}
                            </Button>
                        ))}
                        </div>
                    </div>
                )}

                {quickSaves.length === 0 && namedSaves.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">Nessun salvataggio trovato.</p>
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isSaveAsDialogOpen} onOpenChange={setIsSaveAsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Salva con nome</DialogTitle>
                <DialogDescription>
                    Dai un nome a questo salvataggio per riconoscerlo in futuro.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Input 
                    id="save-as-name" 
                    value={saveAsName} 
                    onChange={e => setSaveAsName(e.target.value)}
                    placeholder="Es. Inizio del Dungeon"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
                />
            </div>
            <DialogFooter>
                <Button onClick={handleSaveAs} disabled={!saveAsName.trim()}>Salva Partita</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={role === 'player' && isCharacterSelectOpen} onOpenChange={handleCharacterSelectOpenChange}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                    <Users className="h-8 w-8 text-primary" />
                    Scegli il tuo Personaggio
                </DialogTitle>
                <DialogDescription>
                    Seleziona un personaggio disponibile per entrare in partita. I personaggi già scelti non sono selezionabili.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className='max-h-[70vh]'>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                    {allCharactersForMap.filter(c => c.isPlayerCharacter).map(char => (
                        <button
                            key={char.id}
                            onClick={() => handleSelectCharacter(char.id)}
                            disabled={!!char.playerId}
                            className="flex flex-col items-center justify-center p-4 gap-2 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: char.icon.type === 'image' ? 'transparent' : char.color }}>
                                {char.icon.type === 'icon' ? (
                                    <GameIcon name={char.icon.name} className="w-8 h-8 text-white" />
                                ) : (
                                    <img src={char.icon.url} alt={char.name} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <span className="font-semibold text-lg text-center">{char.name}</span>
                            {char.playerId && <span className="text-xs text-muted-foreground">(Preso)</span>}
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCharDialogOpen} onOpenChange={setIsAddCharDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <PlusCircle /> Aggiungi Personaggio
            </DialogTitle>
            <DialogDescription>
              Crea un nuovo personaggio giocante (PG) o non giocante (PNG) da aggiungere alla partita.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="char-name-add" className="text-right">Nome</Label>
                <Input 
                    id="char-name-add" 
                    value={newChar.name} 
                    onChange={e => setNewChar({...newChar, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Es. Goblin #1"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="char-maxHp-add" className="text-right">Punti Vita</Label>
                <Input 
                    id="char-maxHp-add"
                    type="number"
                    value={newChar.maxHp} 
                    onChange={e => setNewChar({...newChar, maxHp: parseInt(e.target.value), currentHp: parseInt(e.target.value)})}
                    className="col-span-3"
                />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="char-ac-add" className="text-right">Classe Armatura</Label>
                <Input 
                    id="char-ac-add"
                    type="number"
                    value={newChar.armorClass} 
                    onChange={e => setNewChar({...newChar, armorClass: parseInt(e.target.value)})}
                    className="col-span-3"
                />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <div className="text-right">Tipo</div>
                <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox 
                        id="is-player" 
                        checked={newChar.isPlayerCharacter}
                        onCheckedChange={checked => setNewChar({...newChar, isPlayerCharacter: !!checked})}
                    />
                    <Label htmlFor="is-player" className="font-normal">Personaggio Giocante</Label>
                </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Colore</Label>
                 <div className="col-span-3 grid grid-cols-5 sm:grid-cols-8 gap-2">
                    {DRAW_COLORS.map(color => (
                        <Button
                            key={color}
                            variant={newChar.color === color ? "default" : "outline"}
                            size="icon"
                            style={{ backgroundColor: color, border: '1px solid hsl(var(--border))' }}
                            onClick={() => setNewChar({...newChar, color: color})}
                            aria-label={color}
                        />
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Icona</Label>
                <div className="col-span-3">
                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {Object.keys(iconMap).map(iconKey => (
                            <Button
                                key={iconKey}
                                variant={newChar.icon.type === 'icon' && newChar.icon.name === iconKey ? "default" : "outline"}
                                size="icon"
                                onClick={() => setNewChar({...newChar, icon: {type: 'icon', name: iconKey as keyof typeof iconMap}})}
                                className="aspect-square w-full h-auto"
                            >
                                <GameIcon name={iconKey as keyof typeof iconMap} className="w-5 h-5" />
                            </Button>
                        ))}
                    </div>
                  </ScrollArea>
                   <Button variant="outline" className="w-full mt-2" onClick={handleCharIconUploadClick} disabled={isIconUploading}>
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
                    ref={charIconInputRef}
                    onChange={handleCharIconFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddChar}>Aggiungi alla Partita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewMapDialogOpen} onOpenChange={setIsNewMapDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Map />Crea Nuova Mappa</DialogTitle>
            <DialogDescription>
                Seleziona i personaggi da portare nella nuova mappa. Tutte le aree rivelate e i disegni verranno resettati.
            </DialogDescription>
          </DialogHeader>
           <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-2 py-4">
                    {allCharactersForMap.map(char => (
                        <div key={char.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                            <Checkbox
                                id={`char-select-${char.id}`}
                                checked={newMapCharacterIds[char.id] || false}
                                onCheckedChange={checked => {
                                    setNewMapCharacterIds(prev => ({
                                        ...prev,
                                        [char.id]: !!checked
                                    }));
                                }}
                            />
                            <Label htmlFor={`char-select-${char.id}`} className="flex-1 font-normal cursor-pointer">
                                {char.name} {char.isPlayerCharacter ? '(PG)' : '(PNG)'}
                            </Label>
                        </div>
                    ))}
                </div>
           </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewMapDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateNewMap}>Crea Mappa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
