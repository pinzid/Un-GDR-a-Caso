import type { Icon as IconName } from '@/components/game/icons';

export interface Character {
  id: string;
  name: string;
  icon: { type: 'icon'; name: IconName } | { type: 'image'; url: string };
  color: string;
  position: { x: number; y: number };
  initiative: number;
  playerId: string | null; // null if not taken, player's session ID if taken
  isVisibleToPlayers: boolean;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  isPlayerCharacter: boolean; // True for player characters, false for NPCs
}

export type RevealedArea =
  | {
      id: string;
      shape: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id:string;
      shape: 'circle';
      cx: number;
      cy: number;
      r: number;
    }
  | {
      id: string;
      shape: 'cone';
      x: number;
      y: number;
      radius: number;
      startAngle: number;
      endAngle: number;
    };

export interface DrawingSettings {
    color: string;
    size: number;
}

export type Drawing = {
    id: string;
    type: 'brush' | 'eraser';
    points: {x: number, y: number, pressure?: number}[];
} & DrawingSettings | {
    id: string;
    type: 'rect';
    x: number; y: number; width: number; height: number;
} & DrawingSettings | {
    id: string;
    type: 'circle';
    cx: number; cy: number; r: number;
} & DrawingSettings | {
    id: string;
    type: 'cone';
    x: number; y: number; radius: number; startAngle: number; endAngle: number;
} & DrawingSettings;


export interface ChatMessage {
  id: string;
  sender: {
    name: string;
    role: 'master' | 'player' | 'group';
  };
  content: {
    type: 'text';
    value: string;
  } | {
    type: 'image';
    value: string; // data URI
  };
  timestamp: string;
}

export interface GameState {
  characters: Character[];
  allCharacters?: Character[]; // Optional: For player roles to have the full list for map rendering
  revealedAreas: RevealedArea[];
  drawings: Drawing[];
  chatMessages: ChatMessage[];
  currentTurnId: string;
  mapImage: {
    id: string;
    imageUrl: string;
    description: string;
    imageHint: string;
  };
  timestamp: string;
  version: number;
}

export interface NamedSave {
    name: string;
    state: GameState;
}
