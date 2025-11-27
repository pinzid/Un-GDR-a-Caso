
import 'server-only';
import { initialCharacters } from './initial-data';
import type { GameState, Character, RevealedArea, Drawing, ChatMessage } from './types';
import placeholderData from '@/lib/placeholder-images.json';
import fs from 'fs';
import path from 'path';

const SAVE_FILE = path.join(process.cwd(), 'latest-gamestate.json');
const NEW_MAP_START_POS = { x: 150, y: 100 };

// --- Helper Functions for Visibility ---

function isPointInRect(point: { x: number, y: number }, rect: Extract<RevealedArea, { shape: 'rect' }>): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
         point.y >= rect.y && point.y <= rect.y + rect.height;
}

function isPointInCircle(point: { x: number, y: number }, circle: Extract<RevealedArea, { shape: 'circle' }>): boolean {
  const distance = Math.sqrt(Math.pow(point.x - circle.cx, 2) + Math.pow(point.y - circle.cy, 2));
  return distance <= circle.r;
}

function isPointInCone(point: { x: number, y: number }, cone: Extract<RevealedArea, { shape: 'cone' }>): boolean {
    const dx = point.x - cone.x;
    const dy = point.y - cone.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > cone.radius) {
        return false;
    }
    if (distance === 0) {
        return true; // Origin is always in the cone
    }

    const angle = Math.atan2(dy, dx);

    let start = cone.startAngle;
    let end = cone.endAngle;

    const normalize = (a: number) => {
        let res = a % (2 * Math.PI);
        return res < 0 ? res + 2 * Math.PI : res;
    };
    
    start = normalize(start);
    end = normalize(end);
    const targetAngle = normalize(angle);

    if (start <= end) {
        return targetAngle >= start && targetAngle <= end;
    } else {
        return targetAngle >= start || targetAngle <= end;
    }
}

function isPointInRevealedAreas(point: { x: number, y: number }, areas: RevealedArea[]): boolean {
  for (const area of areas) {
    if (area.shape === 'rect' && isPointInRect(point, area)) return true;
    if (area.shape === 'circle' && isPointInCircle(point, area)) return true;
    if (area.shape === 'cone' && isPointInCone(point, area)) return true;
  }
  return false;
}


// --- Game State Management ---

function createNewGameState(): GameState {
    const sortedInitial = [...initialCharacters].sort((a, b) => b.initiative - a.initiative);
    return {
        characters: sortedInitial,
        revealedAreas: [],
        drawings: [],
        chatMessages: [],
        currentTurnId: sortedInitial[0]?.id || null,
        mapImage: placeholderData.placeholderImages[0],
        timestamp: new Date().toISOString(),
        version: Date.now(),
    };
}


function loadInitialState(): GameState {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const fileContent = fs.readFileSync(SAVE_FILE, 'utf-8');
      const savedState = JSON.parse(fileContent);
      // Reset player control on load, but keep visibility
      const resetCharacters = savedState.characters.map((c: Character) => ({
          ...c, 
          playerId: null, 
          isVisibleToPlayers: c.isPlayerCharacter ? true : (c.isVisibleToPlayers || false),
      }));
      return { ...savedState, characters: resetCharacters, chatMessages: savedState.chatMessages || [] };
    }
  } catch (error) {
    console.error("Error reading save file, starting with initial state:", error);
  }

  return createNewGameState();
}

let gameState: GameState = loadInitialState();

function saveGameStateToFile(state: GameState) {
    try {
        fs.writeFileSync(SAVE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
        console.error("Failed to save game state to file:", error);
    }
}

function updateGameState(newState: Partial<GameState>, saveToFile: boolean = false) {
    gameState = { ...gameState, ...newState, version: Date.now() };
    if (saveToFile) {
        saveGameStateToFile(gameState);
    }
}

// --- Internal State Accessors and Mutators ---

export function getGameState_INTERNAL(): GameState {
  return gameState;
}

export function getGameState_forPlayer(): GameState {
    const { characters, revealedAreas, ...restOfState } = gameState;

    const visibleCharactersForUi = characters.filter(char => {
        if (char.isPlayerCharacter) {
            return true;
        }
        return char.isVisibleToPlayers && isPointInRevealedAreas(char.position, revealedAreas);
    });

    return {
        ...restOfState,
        characters: visibleCharactersForUi, // Filtered list for UI elements like turn tracker
        allCharacters: characters, // Complete list for map rendering logic
        revealedAreas,
    };
}


export function setGameState_INTERNAL(newState: GameState, saveToFile: boolean = false): void {
  const resetCharacters = newState.characters.map(c => ({
      ...c, 
      playerId: null,
      isVisibleToPlayers: c.isPlayerCharacter ? true : (c.isVisibleToPlayers || false),
  }));
  updateGameState({ ...newState, characters: resetCharacters, chatMessages: newState.chatMessages || [] }, saveToFile);
}

export function addChatMessage_INTERNAL(message: ChatMessage): void {
  const newMessages = [...(gameState.chatMessages || []), message];
  updateGameState({ chatMessages: newMessages });
}

export function updateCharacters_INTERNAL(characters: Character[]): void {
  updateGameState({ characters });
}

export function updateCharacter_INTERNAL(character: Character): void {
    const index = gameState.characters.findIndex(c => c.id === character.id);
    if (index !== -1) {
        const newCharacters = [...gameState.characters];
        newCharacters[index] = character;
        updateGameState({ characters: newCharacters });
    }
}

export function removeCharacter_INTERNAL(characterId: string): void {
    const newCharacters = gameState.characters.filter(c => c.id !== characterId);
    let newTurnId = gameState.currentTurnId;
    if (gameState.currentTurnId === characterId) {
        const currentIndex = gameState.characters.findIndex(c => c.id === characterId);
        newTurnId = gameState.characters[(currentIndex + 1) % gameState.characters.length]?.id || null;
        if(newTurnId === characterId) {
            newTurnId = newCharacters[0]?.id || null;
        }
    }
    updateGameState({ characters: newCharacters, currentTurnId: newTurnId });
}

export function updateRevealedAreas_INTERNAL(revealedAreas: RevealedArea[]): void {
  updateGameState({ revealedAreas });
}

export function updateDrawings_INTERNAL(drawings: Drawing[]): void {
  updateGameState({ drawings });
}

export function setMapImage_INTERNAL(mapImage: GameState['mapImage']): void {
  updateGameState({ mapImage });
}

export function nextTurn_INTERNAL(): Character {
  const currentIndex = gameState.characters.findIndex((c) => c.id === gameState.currentTurnId);
  const nextIndex = (currentIndex + 1) % gameState.characters.length;
  const nextCharacter = gameState.characters[nextIndex];
  if(nextCharacter){
    updateGameState({ currentTurnId: nextCharacter.id });
  }
  return nextCharacter;
}

export function previousTurn_INTERNAL(): Character {
  const currentIndex = gameState.characters.findIndex((c) => c.id === gameState.currentTurnId);
  const prevIndex = (currentIndex - 1 + gameState.characters.length) % gameState.characters.length;
  const prevCharacter = gameState.characters[prevIndex];
  if(prevCharacter){
    updateGameState({ currentTurnId: prevCharacter.id });
  }
  return prevCharacter;
}


export function sortCharacters_INTERNAL(): void {
  const sorted = [...gameState.characters].sort((a, b) => b.initiative - a.initiative);
  const newState: Partial<GameState> = { characters: sorted };
  if (sorted.length > 0 && (!gameState.currentTurnId || !sorted.find(c => c.id === gameState.currentTurnId))) {
    newState.currentTurnId = sorted[0].id;
  }
  updateGameState(newState);
}

export function selectCharacter_INTERNAL(characterId: string, playerId: string): boolean {
    const character = gameState.characters.find(c => c.id === characterId);
    if (character && !character.playerId && character.isPlayerCharacter) {
        const updatedCharacters = gameState.characters.map(c => 
            c.id === characterId ? { ...c, playerId, isVisibleToPlayers: true } : c
        );
        updateGameState({ characters: updatedCharacters });
        return true;
    }
    return false;
}

export function releaseCharacter_INTERNAL(characterId: string, playerId: string): void {
    const character = gameState.characters.find(c => c.id === characterId);
    if (character && character.playerId === playerId) {
        const updatedCharacters = gameState.characters.map(c => 
            c.id === characterId ? { ...c, playerId: null } : c
        );
        updateGameState({ characters: updatedCharacters });
    }
}

export function addCharacter_INTERNAL(charData: Omit<Character, 'id' | 'position' | 'initiative' | 'playerId' | 'isVisibleToPlayers'>): void {
    const isPlayer = charData.isPlayerCharacter;
    const newCharacter: Character = {
        id: `char-${Date.now()}`,
        name: charData.name,
        icon: charData.icon,
        color: charData.color,
        position: { x: 100, y: 100 },
        initiative: 0,
        playerId: null,
        isVisibleToPlayers: isPlayer, // Player characters are visible by default
        maxHp: charData.maxHp || 10,
        currentHp: charData.currentHp || 10,
        armorClass: charData.armorClass || 10,
        isPlayerCharacter: isPlayer,
    };
    
    const updatedCharacters = [...gameState.characters, newCharacter];
    updateGameState({ characters: updatedCharacters });
    sortCharacters_INTERNAL();
}

export function updateCharacterVisibility_INTERNAL(characterId: string, isVisible: boolean): void {
    const updatedCharacters = gameState.characters.map(c => 
        c.id === characterId ? { ...c, isVisibleToPlayers: isVisible } : c
    );
    updateGameState({ characters: updatedCharacters });
}

export function resetForNewMap_INTERNAL(characterIdsToKeep: string[]): void {
    let currentX = NEW_MAP_START_POS.x;
    const charactersToKeep = gameState.characters
        .filter(c => characterIdsToKeep.includes(c.id))
        .map((c, index) => {
            const newPosition = { x: NEW_MAP_START_POS.x + (index * 100), y: NEW_MAP_START_POS.y };
            return {
                ...c,
                position: newPosition,
                playerId: null, // Release all players
                initiative: 0,
            };
        });
    
    const sortedCharacters = charactersToKeep.sort((a,b) => b.initiative - a.initiative);

    const newGameState: GameState = {
        characters: sortedCharacters,
        revealedAreas: [],
        drawings: [],
        chatMessages: [],
        currentTurnId: sortedCharacters[0]?.id || null,
        mapImage: placeholderData.placeholderImages[0],
        timestamp: new Date().toISOString(),
        version: Date.now(),
    };
    
    updateGameState(newGameState, true);
}
