

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { CharacterToken } from './character-token';
import type { Character, RevealedArea, Drawing, DrawingSettings, ChatMessage } from '@/lib/types';
import { Ruler, Square, Plus, Minus, Search, Circle, Eye, Hand, Pencil, Brush, Eraser, Palette, Trash2, Triangle, EyeOff, Sparkles, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FogOfWar } from './fog-of-war';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DrawingCanvas } from './drawing-canvas';
import { getStroke } from 'perfect-freehand';
import { getSvgPathFromStroke } from '@/lib/drawing-utils';
import { DRAW_COLORS } from '@/lib/colors';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { GameIcon } from './icons';
import { ChatPanel } from './chat-panel';

interface MapAreaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onTouchStart' | 'onTouchMove' | 'onTouchEnd'> {
  characters: Character[];
  revealedAreas: RevealedArea[];
  setRevealedAreas: (newArea: RevealedArea | RevealedArea[]) => void;
  drawings: Drawing[];
  setDrawings: (newDrawings: Drawing[] | ((d: Drawing[]) => Drawing[])) => void;
  mapImage: {
    id: string;
    imageUrl: string;
    description: string;
    imageHint: string;
  };
  onMouseDownOnToken: (e: React.MouseEvent<HTMLDivElement>, characterId: string) => void;
  onTouchStartOnToken: (e: React.TouchEvent<HTMLDivElement>, characterId: string) => void;
  onMouseUpOnToken: (e: React.MouseEvent<HTMLDivElement>, characterId: string) => void;
  onTouchEndOnToken: (e: React.TouchEvent<HTMLDivElement>, characterId: string) => void;
  onMouseDownOnMap: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTouchStartOnMap: (e: React.TouchEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
  draggingCharacterId: string | null;
  startDragPos: { x: number; y: number } | null;
  currentDragPos: { x: number; y: number } | null;
  isMeasuring: boolean;
  setIsMeasuring: (isMeasuring: boolean) => void;
  role: 'master' | 'player' | 'group';
  viewState: { zoom: number; pan: { x: number; y: number } };
  setViewState: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
  chatMessages: ChatMessage[];
  onSendMessage: (content: ChatMessage['content']) => Promise<void>;
}

const GRID_SIZE = 50; // pixels per grid square
const METERS_PER_SQUARE = 1.5;
const CONE_ANGLE = Math.PI / 3; // 60 degrees cone


type RevealMode = 'rect' | 'circle' | 'cone' | null;
export type DrawMode = 'brush' | 'rect' | 'circle' | 'cone' | 'eraser' | null;
type ConeStep = 'center' | 'radius' | 'angle';


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

export const MapArea = React.forwardRef<HTMLDivElement, MapAreaProps>(
  ({ characters, revealedAreas, setRevealedAreas, drawings, setDrawings, mapImage, onMouseDownOnToken, onTouchStartOnToken, onMouseUpOnToken, onTouchEndOnToken, onMouseDownOnMap, onTouchStartOnMap, draggingCharacterId, startDragPos, currentDragPos, isMeasuring, setIsMeasuring, role, viewState, setViewState, onMouseMove, onMouseUp, onMouseLeave, onTouchMove, onTouchEnd, chatMessages, onSendMessage, ...props }, ref) => {
    
    const isMobile = useIsMobile();
    const [revealMode, setRevealMode] = useState<RevealMode>(null);
    const [drawMode, setDrawMode] = useState<DrawMode>(null);
    const [drawingSettings, setDrawingSettings] = useState<DrawingSettings>({ color: '#FF0000', size: 8 });

    const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
    const [currentDrawing, setCurrentDrawing] = useState<RevealedArea | Drawing | null>(null);
    const [currentPoints, setCurrentPoints] = useState<{x: number, y: number, pressure?: number}[]>([]);
    
    // Cone specific state
    const [coneStep, setConeStep] = useState<ConeStep>('center');
    const coneCenter = useRef<{ x: number, y: number } | null>(null);
    const coneRadius = useRef<number>(0);


    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0 });
    const initialPinchDistance = useRef<number | null>(null);
    const lastZoom = useRef(viewState.zoom);


    const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    const [isRevealPopoverOpen, setIsRevealPopoverOpen] = useState(false);
    const [isDrawPopoverOpen, setIsDrawPopoverOpen] = useState(false);
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);


    useEffect(() => {
      const img = new window.Image();
      img.src = mapImage.imageUrl;
      img.onload = () => {
        setMapDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
    }, [mapImage.imageUrl]);
    
    const distanceInPixels = startDragPos && currentDragPos
      ? Math.sqrt(Math.pow(currentDragPos.x - startDragPos.x, 2) + Math.pow(currentDragPos.y - startDragPos.y, 2))
      : 0;

    const distanceInMeters = ((distanceInPixels / GRID_SIZE) * METERS_PER_SQUARE).toFixed(1);

    const getMapCoordinates = (e: React.MouseEvent<HTMLDivElement> | PointerEvent | React.TouchEvent<HTMLDivElement> | Touch) => {
      const mapEl = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (!mapEl) return { x: 0, y: 0 };
      
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;

      const mapRect = mapEl.getBoundingClientRect();
      const x = (clientX - mapRect.left - viewState.pan.x) / viewState.zoom;
      const y = (clientY - mapRect.top - viewState.pan.y) / viewState.zoom;
      return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
       if (e.button !== 0) return; // Only main click
       
      const coords = getMapCoordinates(e);

      if (isMeasuring) {
        onMouseDownOnMap(e);
        setDrawStart(coords);
        return;
      }

      const isDrawing = drawMode;
      const isRevealing = role === 'master' && revealMode;

      if (isDrawing || isRevealing) {
          e.stopPropagation();

          if (drawMode === 'brush' || drawMode === 'eraser') {
              setCurrentPoints([{ ...coords, pressure: 0.5 }]);
              return;
          }

          if (drawMode === 'cone' || revealMode === 'cone') {
            if (coneStep === 'center') {
              coneCenter.current = coords;
              setConeStep('radius');
              setDrawStart(coords); // Start drawing radius line
            } else if (coneStep === 'angle') {
                if (currentDrawing) {
                    if (revealMode) setRevealedAreas(currentDrawing as RevealedArea);
                    else setDrawings(drawings => [...drawings, currentDrawing as Drawing]);
                }
                resetDrawingState();
            }
          } else {
            setDrawStart(coords);
            const id = `${revealMode ? 'reveal' : 'draw'}-${Date.now()}`;
            const shape = revealMode || drawMode;
            if (shape === 'rect') {
                setCurrentDrawing({
                    id,
                    shape: 'rect',
                    type: 'rect',
                    x: coords.x,
                    y: coords.y,
                    width: 0,
                    height: 0,
                    color: drawingSettings.color, size: drawingSettings.size
                });
            } else if (shape === 'circle') {
                setCurrentDrawing({
                    id,
                    shape: 'circle',
                    type: 'circle',
                    cx: coords.x,
                    cy: coords.y,
                    r: 0,
                    color: drawingSettings.color, size: drawingSettings.size
                });
            }
        }
      } else {
        // Not drawing or measuring, so we start panning
        onMouseDownOnMap(e);
        setIsPanning(true);
        panStart.current = {
          x: e.clientX - viewState.pan.x,
          y: e.clientY - viewState.pan.y
        };
      }
    };

    const handleLocalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const coords = getMapCoordinates(e);
      onMouseMove?.(e); // Propagate to parent for token dragging or measuring
      
      if (isPanning) {
        setViewState(prev => ({
          ...prev,
          pan: {
            x: e.clientX - panStart.current.x,
            y: e.clientY - panStart.current.y
          }
        }));
        return;
      }
      
      const isDrawing = drawMode;
      const isRevealing = role === 'master' && revealMode;

      if (!isDrawing && !isRevealing && !isMeasuring) return;

      if (isMeasuring && e.buttons === 1 && drawStart) {
        // This is handled by parent, but we need to update the end position
        return;
      }

      const { x: currentX, y: currentY } = coords;
      const isInteracting = e.buttons === 1;

      if (drawMode === 'brush' || drawMode === 'eraser') {
        if (isInteracting) {
            setCurrentPoints(prev => [...prev, { x: currentX, y: currentY, pressure: 0.5 }]);
        }
        return;
      }

      const activeMode = drawMode || revealMode;
      
      if (activeMode === 'rect' && drawStart && ((currentDrawing as any)?.type === 'rect' || (currentDrawing as any)?.shape === 'rect') && isInteracting) {
          const newWidth = Math.abs(currentX - drawStart.x);
          const newHeight = Math.abs(currentY - drawStart.y);
          const newX = Math.min(currentX, drawStart.x);
          const newY = Math.min(currentY, drawStart.y);
          setCurrentDrawing(d => ({ ...d, x: newX, y: newY, width: newWidth, height: newHeight } as any));
      } else if (activeMode === 'circle' && drawStart && ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.shape === 'circle') && isInteracting) {
          const radius = Math.sqrt(Math.pow(currentX - drawStart.x, 2) + Math.pow(currentY - drawStart.y, 2));
          setCurrentDrawing(d => ({ ...d, r: radius } as any));
      } else if (activeMode === 'cone' && coneCenter.current) {
         const mainAngle = Math.atan2(currentY - coneCenter.current.y, currentX - coneCenter.current.x);
         const id = (currentDrawing?.id || `${revealMode ? 'reveal' : 'draw'}-${Date.now()}`);
         
         if (coneStep === 'radius' && isInteracting) { // Dragging to set radius
            coneRadius.current = Math.sqrt(Math.pow(currentX - coneCenter.current.x, 2) + Math.pow(currentY - coneCenter.current.y, 2));
            const startAngle = mainAngle - CONE_ANGLE / 2;
            const endAngle = mainAngle + CONE_ANGLE / 2;
             
             setCurrentDrawing({
                id,
                shape: 'cone',
                type: 'cone',
                x: coneCenter.current.x,
                y: coneCenter.current.y,
                radius: coneRadius.current,
                startAngle,
                endAngle,
                color: drawingSettings.color,
                size: drawingSettings.size,
             });
         } else if (coneStep === 'angle') { // Rotating after setting radius
            const startAngle = mainAngle - CONE_ANGLE / 2;
            const endAngle = mainAngle + CONE_ANGLE / 2;
            setCurrentDrawing(prev => ({...prev, shape: 'cone', startAngle, endAngle} as any));
         }
      }
    };
    
    const handleLocalMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseUp?.(e); // Propagate to parent for token dragging or measuring
      
      if (isPanning) {
        setIsPanning(false);
        return;
      }
      
      if (isMeasuring) {
        // Parent handles this
        setDrawStart(null);
        return;
      }
      
      const isDrawing = drawMode;
      const isRevealing = role === 'master' && revealMode;
       const activeMode = drawMode || revealMode;

      if (activeMode === 'rect' || activeMode === 'circle') {
          if (currentDrawing) {
              const d = currentDrawing;
              if ( ( (d as any).shape === 'rect' && ((d as any).width > 0 && (d as any).height > 0) ) || ( (d as any).shape === 'circle' && (d as any).r > 0 ) ) {
                  if (isDrawing) setDrawings(drawings => [...drawings, {...d as Drawing, id: `${d.id}-${role}`}]);
                  if (isRevealing) setRevealedAreas(d as RevealedArea);
              }
          }
          resetDrawingState();
      } else if (activeMode === 'cone') {
          if (coneStep === 'radius') {
              setConeStep('angle'); // Transition to rotation step
              setDrawStart(null); // Stop drawing radius line
          } else if (coneStep === 'angle') {
              // This is handled on the next mousedown
          }
      } else if (drawMode === 'brush' || drawMode === 'eraser') {
          if (currentPoints.length > 0) {
              const newDrawing: Drawing = {
                  id: `drawing-${Date.now()}-${role}`,
                  type: drawMode,
                  points: currentPoints,
                  ...drawingSettings,
              };
              setDrawings(drawings => [...drawings, newDrawing]);
          }
          setCurrentPoints([]);
          // Don't reset state here, allow for multiple brush strokes
      }
    };

    const handleLocalMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        onMouseLeave?.(e);
        setIsPanning(false);
        if (drawStart && (drawMode !== 'cone' || revealMode !== 'cone')) {
          resetDrawingState();
          setCurrentPoints([]);
        }
    };

     const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        const coords = getMapCoordinates(touch);
        
        if (isMeasuring) {
            onTouchStartOnMap(e);
            setDrawStart(coords);
            return;
        }

        if (e.touches.length === 2) {
            e.preventDefault(); // prevent default browser pinch zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
            lastZoom.current = viewState.zoom;
        } else if (e.touches.length === 1) {
            
            const isDrawing = drawMode;
            const isRevealing = role === 'master' && revealMode;

            if (isDrawing || isRevealing) {
                 e.stopPropagation();

                if (drawMode === 'brush' || drawMode === 'eraser') {
                    setCurrentPoints([{ ...coords, pressure: 0.5 }]);
                    return;
                }
                
                if (drawMode === 'cone' || revealMode === 'cone') {
                    if (coneStep === 'center') {
                      coneCenter.current = coords;
                      setConeStep('radius');
                      setDrawStart(coords); // Start drawing radius line
                    } else if (coneStep === 'angle') {
                        if (currentDrawing) {
                            if (revealMode) setRevealedAreas(currentDrawing as RevealedArea);
                            else setDrawings(drawings => [...drawings, currentDrawing as Drawing]);
                        }
                        resetDrawingState();
                    }
                } else {
                    setDrawStart(coords);
                    const id = `${revealMode ? 'reveal' : 'draw'}-${Date.now()}`;
                    const shape = revealMode || drawMode;
                    if (shape === 'rect') {
                        setCurrentDrawing({
                            id,
                            shape: 'rect',
                            type: 'rect',
                            x: coords.x,
                            y: coords.y,
                            width: 0,
                            height: 0,
                            color: drawingSettings.color, size: drawingSettings.size
                        });
                    } else if (shape === 'circle') {
                        setCurrentDrawing({
                            id,
                            shape: 'circle',
                            type: 'circle',
                            cx: coords.x,
                            cy: coords.y,
                            r: 0,
                            color: drawingSettings.color, size: drawingSettings.size
                        });
                    }
                }
            } else {
                 // If not drawing, assume panning
                onTouchStartOnMap(e);
                setIsPanning(true);
                panStart.current = {
                    x: touch.clientX - viewState.pan.x,
                    y: touch.clientY - viewState.pan.y
                };
            }
        }
    };

    const handleLocalTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchMove(e); // Propagate to parent for token dragging
        if (e.touches.length === 2 && initialPinchDistance.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.sqrt(dx * dx + dy * dy);
            const zoomFactor = newDist / initialPinchDistance.current;
            const newZoom = Math.max(0.1, lastZoom.current * zoomFactor);
            setViewState(v => ({ ...v, zoom: newZoom }));
            return;
        } 
        
        if (e.touches.length !== 1) return;
        
        if (isPanning) {
            const touch = e.touches[0];
            setViewState(prev => ({
                ...prev,
                pan: {
                    x: touch.clientX - panStart.current.x,
                    y: touch.clientY - panStart.current.y
                }
            }));
             return;
        } 
        
        const coords = getMapCoordinates(e.touches[0]);
        const { x: currentX, y: currentY } = coords;

        if (drawMode === 'brush' || drawMode === 'eraser') {
            setCurrentPoints(prev => [...prev, { ...coords, pressure: 0.5 }]);
        }

        const activeMode = drawMode || revealMode;
        
        if (activeMode === 'rect' && drawStart && ((currentDrawing as any)?.type === 'rect' || (currentDrawing as any)?.shape === 'rect')) {
            const newWidth = Math.abs(currentX - drawStart.x);
            const newHeight = Math.abs(currentY - drawStart.y);
            const newX = Math.min(currentX, drawStart.x);
            const newY = Math.min(currentY, drawStart.y);
            setCurrentDrawing(d => ({ ...d, x: newX, y: newY, width: newWidth, height: newHeight } as any));
        } else if (activeMode === 'circle' && drawStart && ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.shape === 'circle')) {
            const radius = Math.sqrt(Math.pow(currentX - drawStart.x, 2) + Math.pow(currentY - drawStart.y, 2));
            setCurrentDrawing(d => ({ ...d, r: radius } as any));
        } else if (activeMode === 'cone' && coneCenter.current) {
            const mainAngle = Math.atan2(currentY - coneCenter.current.y, currentX - coneCenter.current.x);
            const id = (currentDrawing?.id || `${revealMode ? 'reveal' : 'draw'}-${Date.now()}`);
            
            if (coneStep === 'radius') { // Dragging to set radius
                coneRadius.current = Math.sqrt(Math.pow(currentX - coneCenter.current.x, 2) + Math.pow(currentY - coneCenter.current.y, 2));
                const startAngle = mainAngle - CONE_ANGLE / 2;
                const endAngle = mainAngle + CONE_ANGLE / 2;
                
                setCurrentDrawing({
                    id,
                    shape: 'cone',
                    type: 'cone',
                    x: coneCenter.current.x,
                    y: coneCenter.current.y,
                    radius: coneRadius.current,
                    startAngle,
                    endAngle,
                    color: drawingSettings.color,
                    size: drawingSettings.size,
                });
            } else if (coneStep === 'angle') { // Rotating after setting radius
                const startAngle = mainAngle - CONE_ANGLE / 2;
                const endAngle = mainAngle + CONE_ANGLE / 2;
                setCurrentDrawing(prev => ({...prev, shape: 'cone', startAngle, endAngle} as any));
            }
        }
    };

    const handleLocalTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        onTouchEnd(e);
        initialPinchDistance.current = null;
        setIsPanning(false);

        if (isMeasuring) {
            setDrawStart(null);
        }

        const isDrawing = drawMode;
        const isRevealing = role === 'master' && revealMode;
        const activeMode = drawMode || revealMode;

        if (activeMode === 'rect' || activeMode === 'circle') {
            if (currentDrawing) {
                const d = currentDrawing;
                if ( ( (d as any).shape === 'rect' && ((d as any).width > 0 && (d as any).height > 0) ) || ( (d as any).shape === 'circle' && (d as any).r > 0 ) ) {
                    if (isDrawing) setDrawings(drawings => [...drawings, {...d as Drawing, id: `${d.id}-${role}`}]);
                    if (isRevealing) setRevealedAreas(d as RevealedArea);
                }
            }
            resetDrawingState();
        } else if (activeMode === 'cone') {
            if (coneStep === 'radius') {
                setConeStep('angle'); // Transition to rotation step
                setDrawStart(null); // Stop drawing radius line
            } else if (coneStep === 'angle') {
                // This is handled on the next touchstart
            }
        } else if (drawMode === 'brush' || drawMode === 'eraser') {
            if (currentPoints.length > 0) {
              const newDrawing: Drawing = {
                  id: `drawing-${Date.now()}-${role}`,
                  type: drawMode,
                  points: currentPoints,
                  ...drawingSettings,
              };
              setDrawings(drawings => [...drawings, newDrawing]);
          }
          setCurrentPoints([]);
        }
    };
    
    const resetDrawingState = () => {
      setDrawStart(null);
      setCurrentDrawing(null);
      setCurrentPoints([]);
      setRevealMode(null);
      setDrawMode(null);
      setConeStep('center');
      coneCenter.current = null;
      coneRadius.current = 0;
    };


    const toggleRevealMode = (mode: RevealMode) => {
      resetDrawingState();
      if (revealMode === mode) {
        setRevealMode(null);
      } else {
        setRevealMode(mode);
        setDrawMode(null);
        setIsMeasuring(false);
      }
      setIsRevealPopoverOpen(false);
    };

    const handleRevealAll = () => {
        if (role !== 'master' || !mapDimensions.width || !mapDimensions.height) return;
        const fullMapArea: RevealedArea = {
            id: `reveal-all-${Date.now()}`,
            shape: 'rect',
            x: 0,
            y: 0,
            width: mapDimensions.width,
            height: mapDimensions.height,
        };
        setRevealedAreas([fullMapArea]); // Replace all other areas
        setIsRevealPopoverOpen(false);
    };
    
    const handleHideAll = () => {
        if (role !== 'master') return;
        setRevealedAreas([]); // Clear all revealed areas
        setIsRevealPopoverOpen(false);
    }


    const toggleDrawMode = (mode: DrawMode) => {
        if (drawMode === mode) {
            setDrawMode(null);
            resetDrawingState();
        } else {
            resetDrawingState();
            setIsMeasuring(false);
            setRevealMode(null);
            setDrawMode(mode);
        }
        setIsDrawPopoverOpen(false);
    }
    
    const handleZoom = (amount: number) => {
      setViewState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom + amount) }));
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const zoomFactor = 0.1;
        if(e.deltaY < 0) {
            handleZoom(zoomFactor);
        } else {
            handleZoom(-zoomFactor);
        }
    };
    
    const activatePanMode = () => {
      setIsMeasuring(false);
      resetDrawingState();
    };

    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          resetDrawingState();
          setIsMeasuring(false);
        }
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }, [setIsMeasuring]);

    const isRulerActive = isMeasuring && startDragPos && currentDragPos && distanceInPixels > 0;
    const isMovingToken = draggingCharacterId && startDragPos && currentDragPos && distanceInPixels > 0;
    const isDrawingShape = (drawMode === 'circle' || drawMode === 'cone' || revealMode === 'circle' || revealMode === 'cone') && currentDrawing;
    const showMeasurement = isRulerActive || isMovingToken || isDrawingShape;
    
    const rulerStart = drawStart || startDragPos;
    let rulerEnd = currentDragPos;

    if (isDrawingShape) {
        if ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.shape === 'circle') {
             rulerEnd = { x: (currentDrawing as any).cx + (currentDrawing as any).r, y: (currentDrawing as any).cy }
        } else if ((currentDrawing as any)?.type === 'cone' || (currentDrawing as any)?.shape === 'cone') {
            rulerEnd = { 
                x: (currentDrawing as any).x + (currentDrawing as any).radius * Math.cos((currentDrawing as any).startAngle + CONE_ANGLE/2), 
                y: (currentDrawing as any).y + (currentDrawing as any).radius * Math.sin((currentDrawing as any).startAngle + CONE_ANGLE/2)
            }
        }
    }


    const isNavMode = !isMeasuring && !revealMode && !drawMode;

    const currentDrawingPath = currentPoints.length > 0 && (drawMode === 'brush' || drawMode === 'eraser')
        ? getSvgPathFromStroke(getStroke(currentPoints, {
            size: drawingSettings.size / viewState.zoom,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
          }))
        : null;

    const previewColor = drawMode === 'eraser' ? '#000' : (revealMode ? '#facc15' : drawingSettings.color);
    const previewFill = (drawMode || revealMode) && (drawMode !== 'brush' && drawMode !== 'eraser') ? `${previewColor}33` : 'transparent';

    let previewRadius = 0;
     if (isDrawingShape) {
        if ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.shape === 'circle') {
            previewRadius = (currentDrawing as any).r;
        } else if ((currentDrawing as any)?.type === 'cone' || (currentDrawing as any)?.shape === 'cone') {
            previewRadius = (currentDrawing as any).radius;
        }
    } else if (currentDrawing && ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.type === 'cone' || (currentDrawing as any)?.shape === 'circle' || (currentDrawing as any)?.shape === 'cone')) {
         if ((currentDrawing as any)?.type === 'circle' || (currentDrawing as any)?.shape === 'circle') {
            previewRadius = (currentDrawing as any).r;
        } else if ((currentDrawing as any)?.type === 'cone' || (currentDrawing as any)?.shape === 'cone') {
            previewRadius = (currentDrawing as any).radius;
        }
    }

    const radiusInMeters = ((previewRadius / GRID_SIZE) * METERS_PER_SQUARE).toFixed(1);


    const drawingPreview = (
        (drawMode || revealMode) && currentDrawing &&
        <g>
            { ((currentDrawing as any).type === 'rect' || (currentDrawing as any).shape === 'rect') && (
                <rect
                    stroke={previewColor}
                    fill={previewFill}
                    strokeWidth={2 / viewState.zoom}
                    strokeDasharray="5,5"
                    x={(currentDrawing as any).x}
                    y={(currentDrawing as any).y}
                    width={(currentDrawing as any).width}
                    height={(currentDrawing as any).height}
                />
            )}
            { ((currentDrawing as any).type === 'circle' || (currentDrawing as any).shape === 'circle') && (
                <circle
                    stroke={previewColor}
                    fill={previewFill}
                    strokeWidth={2 / viewState.zoom}
                    strokeDasharray="5,5"
                    cx={(currentDrawing as any).cx}
                    cy={(currentDrawing as any).cy}
                    r={(currentDrawing as any).r}
                />
            )}
            { ((currentDrawing as any).type === 'cone' || (currentDrawing as any).shape === 'cone') && (
                <path
                    stroke={previewColor}
                    fill={previewFill}
                    strokeWidth={2 / viewState.zoom}
                    strokeDasharray="5,5"
                    d={getArcPath((currentDrawing as any).x, (currentDrawing as any).y, (currentDrawing as any).radius, (currentDrawing as any).startAngle, (currentDrawing as any).endAngle)}
                />
            )}
        </g>
    )

    // Measurement box positioning logic
    let rectX, rectY, textX, textY;
    if (isMobile) {
        // Larger and above the finger
        rectX = rulerEnd ? rulerEnd.x - (50 / viewState.zoom) : 0;
        rectY = rulerEnd ? rulerEnd.y - (80 / viewState.zoom) : 0;
    } else {
        // Smaller and to the side of the cursor
        rectX = rulerEnd ? rulerEnd.x + (15 / viewState.zoom) : 0;
        rectY = rulerEnd ? rulerEnd.y - (12 / viewState.zoom) : 0;
    }
    textX = rectX + (isMobile ? 12 : 5) / viewState.zoom;
    textY = rectY + (isMobile ? 22 : 17) / viewState.zoom;
    const rectWidth = (isDrawingShape ? (isMobile ? 100 : 80) : (isMobile ? 90 : 70)) / viewState.zoom;
    const rectHeight = (isMobile ? 36 : 24) / viewState.zoom;


    return (
      <div
        ref={ref}
        className={cn(
          "relative flex-1 w-full h-full overflow-hidden bg-gray-800 touch-none", // touch-none to prevent browser default touch actions
           isPanning ? 'cursor-grabbing' : (isNavMode ? 'cursor-grab' : 'cursor-crosshair'),
           props.className
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleLocalMouseMove}
        onMouseUp={handleLocalMouseUp}
        onMouseLeave={handleLocalMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleLocalTouchMove}
        onTouchEnd={handleLocalTouchEnd}
      >
        <div 
            className="absolute top-0 left-0"
            style={{ 
                transform: `translate(${viewState.pan.x}px, ${viewState.pan.y}px) scale(${viewState.zoom})`,
                transformOrigin: '0 0'
            }}
        >
          <div className="relative" style={{ width: mapDimensions.width, height: mapDimensions.height }}>
            <Image
              ref={imgRef}
              src={mapImage.imageUrl}
              alt={mapImage.description}
              width={mapDimensions.width}
              height={mapDimensions.height}
              className="object-cover select-none"
              data-ai-hint={mapImage.imageHint}
              priority
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
            <div 
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)',
              }}
            />
            
            <DrawingCanvas
                width={mapDimensions.width}
                height={mapDimensions.height}
                drawings={drawings}
                currentDrawingPath={currentDrawingPath}
                currentDrawingPreview={drawingPreview}
            />
            
            <FogOfWar
              revealedAreas={revealedAreas}
              mapWidth={mapDimensions.width}
              mapHeight={mapDimensions.height}
              role={role}
            />
            
            <div className='absolute inset-0'>
                {characters.map((char) => (
                  <CharacterToken
                    key={char.id}
                    character={char}
                    onMouseDown={(e) => {
                        if (isMeasuring || revealMode || drawMode) return;
                        e.stopPropagation(); // Prevent map panning when clicking token
                        onMouseDownOnToken(e, char.id);
                    }}
                    onMouseUp={(e) => {
                       if (isMeasuring || revealMode || drawMode) return;
                       e.stopPropagation();
                       onMouseUpOnToken(e, char.id);
                    }}
                    onTouchStart={(e) => {
                       if (isMeasuring || revealMode || drawMode) return;
                       e.stopPropagation();
                       onTouchStartOnToken(e, char.id);
                    }}
                    onTouchEnd={(e) => {
                       if (isMeasuring || revealMode || drawMode) return;
                       e.stopPropagation();
                       onTouchEndOnToken(e, char.id);
                    }}
                    isDragging={char.id === draggingCharacterId}
                    role={role}
                  />
                ))}
            </div>

            {showMeasurement && rulerStart && rulerEnd && (
              <svg className="absolute inset-0 pointer-events-none w-full h-full z-30 overflow-visible">
                <line
                  x1={rulerStart.x}
                  y1={rulerStart.y}
                  x2={rulerEnd.x}
                  y2={rulerEnd.y}
                  stroke="#ef4444"
                  strokeWidth={2 / viewState.zoom} // Keep line width consistent on zoom
                  strokeDasharray="5,5"
                />
                 <rect 
                  x={rectX} 
                  y={rectY} 
                  width={rectWidth} 
                  height={rectHeight} 
                  fill="hsl(var(--background))" 
                  rx={4 / viewState.zoom} 
                />
                 <text
                  x={textX}
                  y={textY}
                  fill="hsl(var(--foreground))"
                  fontSize={(isMobile ? 16 : 12) / viewState.zoom}
                  fontWeight="bold"
                >
                  {isDrawingShape ? `r: ${radiusInMeters}m` : `${distanceInMeters}m`}
                </text>
              </svg>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-30">
             <div className="flex flex-col-reverse md:flex-row gap-2">
                <Button variant="secondary" size="icon" onClick={() => handleZoom(0.2)}>
                    <Plus />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => handleZoom(-0.2)}>
                    <Minus />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => setViewState({ zoom: 1, pan: { x: 0, y: 0 }})}>
                    <Search />
                </Button>
            </div>
            <div className="flex flex-col-reverse md:flex-row gap-2 items-end">
                 <Button 
                    variant="secondary" 
                    size="icon" 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    aria-label="Toggle chat"
                >
                    <MessageSquare />
                </Button>
                <Button
                    variant={isNavMode ? 'default' : 'secondary'}
                    size="icon"
                    onClick={activatePanMode}
                    aria-label="Navigation mode"
                >
                    <Hand />
                </Button>
                <Button
                    variant={isMeasuring ? 'default' : 'secondary'}
                    size="icon"
                    onClick={() => {
                        setIsMeasuring(!isMeasuring);
                        resetDrawingState();
                    }}
                    aria-label="Toggle measurement tool"
                >
                    <Ruler />
                </Button>
              <Popover open={isDrawPopoverOpen} onOpenChange={setIsDrawPopoverOpen}>
                  <PopoverTrigger asChild>
                      <Button
                          variant={drawMode ? 'default' : 'secondary'}
                          size="icon"
                          aria-label="Drawing tools"
                      >
                          <Pencil />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side="top" align="end">
                      <div className="flex flex-col gap-2">
                          <div className='flex gap-2'>
                              <Button variant={drawMode === 'brush' ? 'default' : 'secondary'} size="icon" onClick={() => toggleDrawMode('brush')} aria-label="Brush tool">
                                  <Brush />
                              </Button>
                              <Button variant={drawMode === 'rect' ? 'default' : 'secondary'} size="icon" onClick={() => toggleDrawMode('rect')} aria-label="Square tool">
                                  <Square />
                              </Button>
                              <Button variant={drawMode === 'circle' ? 'default' : 'secondary'} size="icon" onClick={() => toggleDrawMode('circle')} aria-label="Circle tool">
                                  <Circle />
                              </Button>
                              <Button variant={drawMode === 'cone' ? 'default' : 'secondary'} size="icon" onClick={() => toggleDrawMode('cone')} aria-label="Cone tool">
                                  <GameIcon name="Triangle" />
                              </Button>
                              <Button variant={drawMode === 'eraser' ? 'default' : 'secondary'} size="icon" onClick={() => toggleDrawMode('eraser')} aria-label="Eraser tool">
                                  <Eraser />
                              </Button>
                          </div>
                          <div className="flex gap-2 items-center">
                              <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                                  <PopoverTrigger asChild>
                                      <Button size="icon" variant="outline">
                                          <Palette style={{ color: drawingSettings.color }} />
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-2" side="top" align="end">
                                      <div className="grid grid-cols-5 gap-2">
                                          {DRAW_COLORS.map(color => (
                                              <Button
                                                  key={color}
                                                  size="icon"
                                                  variant={drawingSettings.color === color ? 'default' : 'ghost'}
                                                  style={{ backgroundColor: color, border: '1px solid hsl(var(--border))' }}
                                                  onClick={() => {
                                                      setDrawingSettings(s => ({...s, color}));
                                                      setIsColorPopoverOpen(false);
                                                  }}
                                                  aria-label={color}
                                              />
                                          ))}
                                      </div>
                                  </PopoverContent>
                              </Popover>

                              <input type="range" min="2" max="32" value={drawingSettings.size} onChange={e => setDrawingSettings(s => ({...s, size: parseInt(e.target.value, 10)}))} className="w-full" />
                          </div>
                      </div>
                  </PopoverContent>
              </Popover>

              {role === 'master' && (
                <Popover open={isRevealPopoverOpen} onOpenChange={setIsRevealPopoverOpen}>
                  <PopoverTrigger asChild>
                     <Button
                        variant={revealMode ? 'default' : 'secondary'}
                        size="icon"
                        aria-label="Reveal area tools"
                      >
                        <Eye />
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side="top" align="end">
                      <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                              <Button
                                variant={revealMode === 'rect' ? 'default' : 'secondary'}
                                size="icon"
                                onClick={() => toggleRevealMode('rect')}
                                aria-label="Reveal area tool with rectangle"
                              >
                                <Square />
                              </Button>
                               <Button
                                variant={revealMode === 'circle' ? 'default' : 'secondary'}
                                size="icon"
                                onClick={() => toggleRevealMode('circle')}
                                aria-label="Reveal area tool with circle"
                              >
                                <Circle />
                              </Button>
                               <Button
                                variant={revealMode === 'cone' ? 'default' : 'secondary'}
                                size="icon"
                                onClick={() => toggleRevealMode('cone')}
                                aria-label="Reveal area tool with cone"
                              >
                                <GameIcon name="Triangle" />
                              </Button>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-2">
                             <Button
                                variant='secondary'
                                size="sm"
                                onClick={handleHideAll}
                                aria-label="Hide all"
                                className='text-red-500 hover:bg-destructive/10 hover:text-red-600'
                              >
                                <EyeOff className="mr-2 h-4 w-4" />
                                Nascondi
                              </Button>
                              <Button
                                variant='secondary'
                                size="sm"
                                onClick={handleRevealAll}
                                aria-label="Reveal all"
                                className='text-green-500 hover:bg-green-500/10 hover:text-green-600'
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                Rivela
                              </Button>
                          </div>
                      </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
        </div>
         {isChatOpen && (
              <ChatPanel 
                role={role} 
                messages={chatMessages}
                onSendMessage={onSendMessage} 
                onClose={() => setIsChatOpen(false)}
              />
            )}
      </div>
    );
  }
);

MapArea.displayName = 'MapArea';
