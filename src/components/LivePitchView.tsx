import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type Player = {
  id: string;
  name: string;
  position: string;
  x: number;
  y: number;
  isOnPitch: boolean;
};

export const PITCH_SPOTS = [
  { id: 'gk', x: 50, y: 88 },
  { id: 'lb', x: 15, y: 72 },
  { id: 'lcb', x: 32.5, y: 75 },
  { id: 'cb', x: 50, y: 75 },
  { id: 'rcb', x: 67.5, y: 75 },
  { id: 'rb', x: 85, y: 72 },
  { id: 'lm', x: 15, y: 50 },
  { id: 'lcm', x: 32.5, y: 53 },
  { id: 'cm', x: 50, y: 55 },
  { id: 'rcm', x: 67.5, y: 53 },
  { id: 'rm', x: 85, y: 50 },
  { id: 'lw', x: 15, y: 28 },
  { id: 'lf', x: 32.5, y: 25 },
  { id: 'cf', x: 50, y: 25 },
  { id: 'rf', x: 67.5, y: 25 },
  { id: 'rw', x: 85, y: 28 },
];

const PlayerNode: React.FC<{ 
  player: Player;
  isSelected: boolean;
  isCoach: boolean;
  onClick: () => void;
  onMove: (id: string, x: number, y: number) => void;
}> = ({ 
  player, 
  isSelected, 
  isCoach, 
  onClick, 
  onMove 
}) => {
  const [dragging, setDragging] = useState(false);
  const [localPos, setLocalPos] = useState({ x: player.x, y: player.y });
  const localPosRef = useRef({ x: player.x, y: player.y });

  useEffect(() => {
    if (!dragging) {
      setLocalPos({ x: player.x, y: player.y });
      localPosRef.current = { x: player.x, y: player.y };
    }
  }, [player.x, player.y, dragging]);

  const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isCoach) return;
    setDragging(true);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;

      const pitch = document.getElementById("pitch");
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();

      let clientX = 0;
      let clientY = 0;
      if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      let x = ((clientX - rect.left) / rect.width) * 100;
      let y = ((clientY - rect.top) / rect.height) * 100;

      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      setLocalPos({ x, y });
      localPosRef.current = { x, y };
    };

    const stopDrag = () => {
      if (dragging) {
        setDragging(false);
        // Find nearest spot
        let nearestSpot = PITCH_SPOTS[0];
        let minDistance = Infinity;
        
        PITCH_SPOTS.forEach(spot => {
          const dx = spot.x - localPosRef.current.x;
          // Scale y distance slightly because pitch is a rectangle aspect ratio
          const dy = (spot.y - localPosRef.current.y) * 1.5; 
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            nearestSpot = spot;
          }
        });

        // Snap if close enough, else stay at valid pitch pos, or enforce snap always:
        // Enforce always snapping to the nearest open outfield spot
        onMove(player.id, nearestSpot.x, nearestSpot.y);
      }
    };

    if (dragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", stopDrag);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("touchend", stopDrag);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", stopDrag);
      document.body.style.overflow = "";
    };
  }, [dragging, onMove, player.id]);

  return (
    <div
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onClick={onClick}
      className={`absolute flex flex-col items-center justify-center cursor-pointer select-none transition-transform z-10 ${isSelected ? 'scale-110' : ''} ${dragging ? 'scale-125 z-50 shadow-2xl' : 'hover:scale-110'}`}
      style={{
        left: `${localPos.x}%`,
        top: `${localPos.y}%`,
        transform: "translate(-50%, -50%)",
        transition: dragging ? 'none' : 'left 0.3s ease-out, top 0.3s ease-out'
      }}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md border-2 ${isSelected ? 'bg-blue-500 border-blue-300 text-white animate-pulse' : 'bg-white text-slate-900 border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white'} ${dragging ? 'border-blue-400 border-4' : ''}`}>
        {player.name.substring(0, 2).toUpperCase()}
      </div>
      <div className="mt-1 px-1.5 py-0.5 bg-white/90 dark:bg-black/60 rounded text-[10px] font-bold text-slate-900 dark:text-white text-center leading-tight max-w-[64px] break-words shadow-sm pointer-events-none">
        {player.name}
      </div>
    </div>
  );
};

interface LivePitchViewProps {
  initialPitchPlayers: Player[];
  initialBenchPlayers: Player[];
  onSubstitute?: (playerOffId: string, playerOnId: string) => void;
  onMove?: (playerId: string, x: number, y: number) => void;
  isCoach?: boolean;
}

export function LivePitchView({ 
  initialPitchPlayers, 
  initialBenchPlayers, 
  onSubstitute,
  onMove,
  isCoach = false 
}: LivePitchViewProps) {
  const [pitchPlayers, setPitchPlayers] = useState<Player[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<Player[]>([]);
  const [selectedBenchPlayer, setSelectedBenchPlayer] = useState<Player | null>(null);

  useEffect(() => {
    setPitchPlayers(initialPitchPlayers);
    setBenchPlayers(initialBenchPlayers);
  }, [initialPitchPlayers, initialBenchPlayers]);

  const handleSubstitution = (pitchPlayer: Player) => {
    if (!selectedBenchPlayer || !isCoach) return;

    if (onSubstitute) {
      onSubstitute(pitchPlayer.id, selectedBenchPlayer.id);
    } else {
      setPitchPlayers(prev =>
        prev.map(p =>
          p.id === pitchPlayer.id
            ? { ...selectedBenchPlayer, x: p.x, y: p.y, isOnPitch: true }
            : p
        )
      );

      setBenchPlayers(prev =>
        prev.map(p =>
          p.id === selectedBenchPlayer.id
            ? { ...pitchPlayer, isOnPitch: false }
            : p
        )
      );
    }
    setSelectedBenchPlayer(null);
  };

  const handleMovePlayer = (id: string, x: number, y: number) => {
    if (!isCoach) return;
    if (onMove) onMove(id, x, y);
    setPitchPlayers(prev =>
      prev.map(p =>
        p.id === id ? { ...p, x, y } : p
      )
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* PitchContainer */}
      <div id="pitch" className="relative w-full aspect-[4/5] bg-green-600 border-2 border-white/20 rounded-xl overflow-hidden shadow-xl touch-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(255,255,255,0.05) 10%, rgba(255,255,255,0.05) 20%)' }}>
        {/* Pitch Markings */}
        <div className="absolute inset-4 border-2 border-white/40 pointer-events-none" />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-2 border-white/40 border-t-0 pointer-events-none" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-2 border-white/40 border-b-0 pointer-events-none" />
        <div className="absolute top-1/2 left-4 w-[calc(100%-32px)] h-px bg-white/40 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] aspect-square rounded-full border-2 border-white/40 pointer-events-none" />

        {/* Snap Spots */}
        {PITCH_SPOTS.map(spot => (
          <div
            key={spot.id}
            className="absolute rounded-full border-2 border-white/20 border-dashed pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: '44px',
              height: '44px',
            }}
          />
        ))}

        {/* Players */}
        {pitchPlayers.map((player, index) => (
          <PlayerNode
            key={player.id}
            player={player}
            isSelected={selectedBenchPlayer !== null}
            isCoach={isCoach}
            onClick={() => {
              if (selectedBenchPlayer) handleSubstitution(player);
            }}
            onMove={handleMovePlayer}
          />
        ))}
      </div>

      {/* BenchPanel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Bench</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {benchPlayers.length === 0 ? (
            <p className="text-slate-500 text-sm italic">No players on the bench.</p>
          ) : (
            benchPlayers.map(player => (
              <button
                key={player.id}
                onClick={() => setSelectedBenchPlayer(player)}
                disabled={!isCoach}
                className={`flex flex-col items-center flex-shrink-0 p-2 rounded-xl border transition-colors ${
                  selectedBenchPlayer?.id === player.id
                    ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-1 ${
                  selectedBenchPlayer?.id === player.id ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {player.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider max-w-[60px] truncate">
                  {player.name}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Substitution Modal - Only shown if not handled upstream by parent */}
      <AnimatePresence>
        {selectedBenchPlayer && !onSubstitute && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                    <ArrowLeftRight className="text-blue-500" size={20} />
                    Substitute
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select player to replace</p>
                </div>
                <button 
                  onClick={() => setSelectedBenchPlayer(null)} 
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-50 bg-slate-100 dark:bg-slate-800 p-2 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {pitchPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleSubstitution(player)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        {player.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-50">{player.name}</span>
                    </div>
                    <ArrowLeftRight size={16} className="text-slate-400 dark:text-slate-500" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
