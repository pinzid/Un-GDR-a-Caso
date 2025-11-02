'use server';

import { revalidateTag } from 'next/cache';
import { 
  getGameState_INTERNAL, 
  getGameState_forPlayer,
  setGameState_INTERNAL,
  updateCharacters_INTERNAL,
  updateRevealedAreas_INTERNAL,
  setMapImage_INTERNAL,
  nextTurn_INTERNAL,
  previousTurn_INTERNAL,
  sortCharacters_INTERNAL,
  selectCharacter_INTERNAL,
  releaseCharacter_INTERNAL,
  addCharacter_INTERNAL,
  updateCharacterVisibility_INTERNAL,
  updateDrawings_INTERNAL,
  updateCharacter_INTERNAL,
  removeCharacter_INTERNAL,
  resetForNewMap_INTERNAL,
} from '@/lib/game-state';
import type { GameState, Character, RevealedArea, Drawing } from '@/lib/types';
import { headers } from 'next/headers';
import { use } from 'react';

function getPlayerId() {
  // A simple way to get a unique ID for the player's session
  return headers().get('x-forwarded-for') || 'local';
}

// Helper to get the role from headers, since we can't use searchParams in server actions directly
function getRoleFromHeaders(): 'master' | 'player' | 'group' {
    const referer = headers().get('referer');
    if (referer) {
        const url = new URL(referer);
        const role = url.searchParams.get('role');
        if (role === 'player') {
            return 'player';
        }
         if (role === 'group') {
            return 'group';
        }
    }
    return 'master';
}

export async function getGameState(): Promise<GameState> {
  const role = getRoleFromHeaders();
  if (role === 'player' || role === 'group') {
    return getGameState_forPlayer();
  }
  return getGameState_INTERNAL();
}

export async function updateCharacters(characters: Character[]): Promise<void> {
  updateCharacters_INTERNAL(characters);
}

export async function updateCharacter(character: Character): Promise<void> {
  updateCharacter_INTERNAL(character);
}

export async function removeCharacter(characterId: string): Promise<void> {
    removeCharacter_INTERNAL(characterId);
}

export async function updateRevealedAreas(revealedAreas: RevealedArea[]): Promise<void> {
  updateRevealedAreas_INTERNAL(revealedAreas);
}

export async function updateDrawings(drawings: Drawing[]): Promise<void> {
  updateDrawings_INTERNAL(drawings);
}

export async function setMapImage(mapImage: GameState['mapImage']): Promise<void> {
  setMapImage_INTERNAL(mapImage);
}

export async function nextTurn(): Promise<Character> {
  return nextTurn_INTERNAL();
}

export async function previousTurn(): Promise<Character> {
    return previousTurn_INTERNAL();
}

export async function sortCharacters(): Promise<void> {
  sortCharacters_INTERNAL();
}

export async function replaceGameState(newState: GameState): Promise<void> {
  setGameState_INTERNAL(newState, true); // Save to file
}

export async function selectCharacter(characterId: string): Promise<boolean> {
  const playerId = getPlayerId();
  return selectCharacter_INTERNAL(characterId, playerId);
}

export async function releaseCharacter(characterId: string): Promise<void> {
    const playerId = getPlayerId();
    releaseCharacter_INTERNAL(characterId, playerId);
}

export async function addCharacter(charData: Omit<Character, 'id' | 'position' | 'initiative' | 'playerId' | 'isVisibleToPlayers'>): Promise<void> {
  addCharacter_INTERNAL(charData);
}

export async function updateCharacterVisibility(characterId: string, isVisible: boolean): Promise<void> {
  updateCharacterVisibility_INTERNAL(characterId, isVisible);
}

export async function resetForNewMap(characterIdsToKeep: string[]): Promise<void> {
  resetForNewMap_INTERNAL(characterIdsToKeep);
}
    

    
