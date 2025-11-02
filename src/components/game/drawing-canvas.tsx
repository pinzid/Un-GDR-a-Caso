'use client';

import React from 'react';
import type { Drawing } from '@/lib/types';
import { getStroke } from 'perfect-freehand';
import { getSvgPathFromStroke } from '@/lib/drawing-utils';

interface DrawingCanvasProps {
    width: number;
    height: number;
    drawings: Drawing[];
    currentDrawingPath: string | null;
    currentDrawingPreview: React.ReactNode;
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

export function DrawingCanvas({
    width,
    height,
    drawings,
    currentDrawingPath,
    currentDrawingPreview,
}: DrawingCanvasProps) {

    if (width === 0 || height === 0) {
        return null;
    }

    return (
        <svg
            data-drawing-canvas-root
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            <g>
                {drawings.map((drawing) => {
                    if (drawing.type === 'brush' || drawing.type === 'eraser') {
                        const stroke = getStroke(drawing.points, {
                            size: drawing.size,
                            thinning: 0.5,
                            smoothing: 0.5,
                            streamline: 0.5,
                        });
                        const pathData = getSvgPathFromStroke(stroke);
                        return (
                            <path
                                key={drawing.id}
                                d={pathData}
                                fill={drawing.type === 'eraser' ? 'none' : drawing.color}
                                stroke={drawing.type === 'eraser' ? 'none' : drawing.color}
                                strokeWidth="1"
                                style={{
                                    mixBlendMode: drawing.type === 'eraser' ? 'destination-out' : 'normal',
                                }}
                            />
                        );
                    }
                    if (drawing.type === 'rect') {
                        return (
                            <rect
                                key={drawing.id}
                                x={drawing.x}
                                y={drawing.y}
                                width={drawing.width}
                                height={drawing.height}
                                fill="none"
                                stroke={drawing.color}
                                strokeWidth={drawing.size / 4}
                            />
                        )
                    }
                     if (drawing.type === 'circle') {
                        return (
                            <circle
                                key={drawing.id}
                                cx={drawing.cx}
                                cy={drawing.cy}
                                r={drawing.r}
                                fill="none"
                                stroke={drawing.color}
                                strokeWidth={drawing.size / 4}
                            />
                        )
                    }
                    if (drawing.type === 'cone') {
                         return (
                            <path
                                key={drawing.id}
                                d={getArcPath(drawing.x, drawing.y, drawing.radius, drawing.startAngle, drawing.endAngle)}
                                fill="none"
                                stroke={drawing.color}
                                strokeWidth={drawing.size / 4}
                            />
                        )
                    }
                    return null;
                })}

                {currentDrawingPath && (
                     <path
                        d={currentDrawingPath}
                        fill={'currentColor'}
                        stroke={'currentColor'}
                        strokeWidth="1"
                        style={{
                            opacity: 0.5,
                        }}
                    />
                )}
                 {currentDrawingPreview}
            </g>
        </svg>
    );
}
