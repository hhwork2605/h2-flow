/**
 * CanvasBottomBar — zoom controls trái + Căn giữa center (TobyFlow-style).
 *
 * Layer: UI
 * Owner: features/workflow/components
 *
 * Floating bottom bar trên canvas, không thay React Flow Controls
 * (đã hide trong DiagramCanvas).
 */

import { Crosshair, Minus, Plus, RotateCcw } from 'lucide-react';
import { useReactFlow, useViewport } from 'reactflow';
import { cn } from '@/utils/cn';

export function CanvasBottomBar() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { zoom } = useViewport();

  /** Reset zoom 100% — KHÔNG zoom-to-fit. Giữ origin (0,0). */
  const resetZoom = () => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });

  return (
    <>
      {/* Bottom-left: zoom controls */}
      <div
        className={cn(
          'absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-md border border-white/5 bg-[#15151c]/95 px-1 py-1',
          'shadow-card-dark backdrop-blur',
        )}
      >
        <ZoomBtn label="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
          <Minus className="h-3.5 w-3.5" />
        </ZoomBtn>
        <span className="px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <ZoomBtn label="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
          <Plus className="h-3.5 w-3.5" />
        </ZoomBtn>
        <span className="mx-0.5 h-4 w-px bg-white/5" />
        <ZoomBtn label="Reset zoom 100%" onClick={resetZoom}>
          <RotateCcw className="h-3.5 w-3.5" />
        </ZoomBtn>
      </div>

      {/* Bottom-center: Căn giữa */}
      <button
        type="button"
        onClick={() => fitView({ duration: 200, padding: 0.2 })}
        className={cn(
          'absolute bottom-3 left-1/2 z-10 -translate-x-1/2',
          'inline-flex h-8 items-center gap-1.5 rounded-md border border-white/5 bg-[#15151c]/95 px-3',
          'text-[12px] font-medium text-muted-foreground shadow-card-dark backdrop-blur',
          'hover:bg-white/5 hover:text-foreground',
        )}
      >
        <Crosshair className="h-3.5 w-3.5" />
        Căn giữa
      </button>
    </>
  );
}

interface ZoomBtnProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}
function ZoomBtn({ label, onClick, children }: ZoomBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
    >
      {children}
    </button>
  );
}
