'use client';

import {
  Swords,
  Shield,
  Heart,
  UserRound,
  FlaskConical,
  Skull,
  Ghost,
  PersonStanding,
  Wand2,
  Axe,
  Triangle,
  type Icon as LucideIcon,
  ShieldQuestion,
  Loader,
  MessageSquare,
} from 'lucide-react';
import React from 'react';

export const iconMap = {
  Swords,
  Shield,
  Heart,
  UserRound,
  FlaskConical,
  Skull,
  Ghost,
  PersonStanding,
  Wand2,
  Axe,
  Triangle,
  Loader,
  MessageSquare,
};

export type Icon = keyof typeof iconMap;

export const GameIcon = ({ name, ...props }: { name: Icon } & React.ComponentProps<LucideIcon>) => {
  const LucideIconComponent = iconMap[name];
  if (!LucideIconComponent) {
    return <ShieldQuestion {...props} />; // A default icon if something is missing
  }
  return <LucideIconComponent {...props} />;
};
