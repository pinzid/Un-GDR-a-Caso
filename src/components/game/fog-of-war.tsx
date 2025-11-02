'use client';

import React from 'react';
import type { RevealedArea } from '@/lib/types';

interface FogOfWarProps {
  revealedAreas: RevealedArea[];
  mapWidth: number;
  mapHeight: number;
  role: 'master' | 'player' | 'group';
}

function getArcPath(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = {
    x: x + radius * Math.cos(startAngle),
    y: y + radius * Math.sin(startAngle)
  };
  const end = {
    x: x + radius * Math.cos(endAngle),
    y: y + radius * Math.sin(endAngle)
  };

  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

  return [
    "M", x, y,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y,
    "Z"
  ].join(" ");
}


export function FogOfWar({ revealedAreas, mapWidth, mapHeight, role }: FogOfWarProps) {
  if (mapWidth === 0 || mapHeight === 0) {
    return null;
  }
  
  const isPlayerView = role === 'player' || role === 'group';
  const fillColor = isPlayerView ? 'rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.5)';

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      <defs>
        <mask id="fog-mask">
          <rect width={mapWidth} height={mapHeight} fill="white" />
          {revealedAreas.map((area) => {
            if (area.shape === 'rect') {
              return (
                <rect
                  key={area.id}
                  x={area.x}
                  y={area.y}
                  width={area.width}
                  height={area.height}
                  fill="black"
                />
              );
            }
             if (area.shape === 'circle') {
              return (
                <circle
                  key={area.id}
                  cx={area.cx}
                  cy={area.cy}
                  r={area.r}
                  fill="black"
                />
              );
            }
            if (area.shape === 'cone') {
              return (
                <path
                  key={area.id}
                  d={getArcPath(area.x, area.y, area.radius, area.startAngle, area.endAngle)}
                  fill="black"
                />
              );
            }
            return null;
          })}
        </mask>
      </defs>
      <rect
        width={mapWidth}
        height={mapHeight}
        fill={fillColor}
        mask="url(#fog-mask)"
      />
    </svg>
  );
}
