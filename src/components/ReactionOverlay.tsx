import React from 'react';
import { ReactionItem } from '../types';

interface ReactionOverlayProps {
  reactions: ReactionItem[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-16 animate-float-up flex flex-col items-center select-none"
          style={{
            left: `${r.x}%`,
            animationDuration: '3.2s',
          }}
        >
          <span className="text-4xl drop-shadow-lg filter transform hover:scale-125 transition-transform">
            {r.emoji}
          </span>
          <span className="text-[10px] bg-black/60 backdrop-blur-xs text-white/80 px-1.5 py-0.5 rounded-full mt-1 border border-white/10 shadow-xs">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};
