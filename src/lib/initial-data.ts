import type { Character } from './types';

export const initialCharacters: Character[] = [
  {
    id: 'char1',
    name: 'Gimli',
    icon: { type: 'icon', name: 'Axe' },
    color: '#e53e3e', // Red
    position: { x: 150, y: 100 },
    initiative: 0,
    playerId: null,
    isVisibleToPlayers: true,
    maxHp: 25,
    currentHp: 25,
    armorClass: 16,
    isPlayerCharacter: true,
  },
  {
    id: 'char2',
    name: 'Legolas',
    icon: { type: 'icon', name: 'UserRound' },
    color: '#38a169', // Green
    position: { x: 250, y: 100 },
    initiative: 0,
    playerId: null,
    isVisibleToPlayers: true,
    maxHp: 20,
    currentHp: 20,
    armorClass: 14,
    isPlayerCharacter: true,
  },
  {
    id: 'char3',
    name: 'Gandalf',
    icon: { type: 'icon', name: 'Wand2' },
    color: '#3182ce', // Blue
    position: { x: 350, y: 100 },
    initiative: 0,
    playerId: null,
    isVisibleToPlayers: true,
    maxHp: 18,
    currentHp: 18,
    armorClass: 12,
    isPlayerCharacter: true,
  },
  {
    id: 'char4',
    name: 'Aragorn',
    icon: { type: 'icon', name: 'Swords' },
    color: '#805ad5', // Purple
    position: { x: 450, y: 100 },
    initiative: 0,
    playerId: null,
    isVisibleToPlayers: true,
    maxHp: 22,
    currentHp: 22,
    armorClass: 15,
    isPlayerCharacter: true,
  },
];
