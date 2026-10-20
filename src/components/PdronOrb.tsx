'use client';

import React from 'react';

interface PdronOrbProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  state?: 'idle' | 'thinking' | 'speaking';
  className?: string;
  glow?: boolean;
}

export default function PdronOrb({
  size = 'md',
  state = 'idle',
  className = '',
  glow = true
}: PdronOrbProps) {
  // Boyut haritalaması (px)
  const sizeMap = {
    xs: { outer: 'w-4 h-4', orb: 'w-3.5 h-3.5', ring: 'inset-[-2px]' },
    sm: { outer: 'w-6 h-6', orb: 'w-5 h-5', ring: 'inset-[-3px]' },
    md: { outer: 'w-9 h-9', orb: 'w-7 h-7', ring: 'inset-[-4px]' },
    lg: { outer: 'w-14 h-14', orb: 'w-11 h-11', ring: 'inset-[-6px]' },
    xl: { outer: 'w-20 h-20', orb: 'w-16 h-16', ring: 'inset-[-8px]' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isThinking = state === 'thinking';

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 select-none ${currentSize.outer} ${className}`}>
      {/* 1. Dış Halka / Yörünge (Thinking durumunda döner, Idle durumunda hafif parlar) */}
      <div
        className={`absolute rounded-full border transition-all duration-700 pointer-events-none ${currentSize.ring} ${
          isThinking
            ? 'border-t-emerald-400 border-r-cyan-400 border-b-indigo-500 border-l-transparent animate-spin opacity-100 duration-1000'
            : 'border-emerald-400/30 opacity-60 scale-95'
        }`}
        style={{
          boxShadow: isThinking
            ? '0 0 16px rgba(16, 185, 129, 0.4), inset 0 0 10px rgba(6, 182, 212, 0.3)'
            : '0 0 8px rgba(16, 185, 129, 0.15)'
        }}
      />

      {/* 2. Karşıt Dönüş Yapan İnce İkinci Halka (Sadece Thinking modunda belirir) */}
      {isThinking && (
        <div
          className={`absolute rounded-full border border-dashed border-cyan-300/60 pointer-events-none ${currentSize.ring}`}
          style={{
            animation: 'spin 3s linear infinite reverse',
            transform: 'rotateX(50deg)'
          }}
        />
      )}

      {/* 3. Dış Hüzme & Atmosferik Işıma (Glow / Aura) */}
      {glow && (
        <div
          className={`absolute rounded-full transition-all duration-500 pointer-events-none blur-sm ${currentSize.orb} ${
            isThinking
              ? 'bg-gradient-to-tr from-emerald-400 via-cyan-400 to-indigo-500 opacity-80 scale-125 animate-pulse'
              : 'bg-emerald-400/40 opacity-50 scale-110'
          }`}
        />
      )}

      {/* 4. Ana Holografik Küre Gövdesi (Minimalist Orb) */}
      <div
        className={`relative rounded-full overflow-hidden transition-transform duration-700 flex items-center justify-center ${currentSize.orb} ${
          isThinking ? 'scale-105' : 'hover:scale-105'
        }`}
        style={{
          background: isThinking
            ? 'radial-gradient(circle at 35% 35%, #34d399 0%, #06b6d4 35%, #2563eb 70%, #0f172a 100%)'
            : 'radial-gradient(circle at 35% 35%, #10b981 0%, #0284c7 45%, #1e1b4b 85%, #020617 100%)',
          boxShadow: isThinking
            ? 'inset 0 0 12px rgba(255, 255, 255, 0.6), 0 0 20px rgba(52, 211, 153, 0.6)'
            : 'inset 0 0 8px rgba(255, 255, 255, 0.35), 0 0 12px rgba(16, 185, 129, 0.35)',
          animation: isThinking
            ? 'pdron-thinking-pulse 1.2s ease-in-out infinite alternate'
            : 'pdron-breathing 3.5s ease-in-out infinite alternate'
        }}
      >
        {/* Işık Yansıması (Specular Highlight - 3D Cam / Hologram Efekti) */}
        <div
          className="absolute top-[12%] left-[18%] w-[38%] h-[32%] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 70%)',
            transform: 'rotate(-25deg)'
          }}
        />

        {/* İç Çekirdek Nabzı */}
        <div
          className={`w-1/3 h-1/3 rounded-full transition-opacity duration-500 pointer-events-none ${
            isThinking
              ? 'bg-white opacity-85 animate-ping'
              : 'bg-emerald-200/50 opacity-40'
          }`}
        />
      </div>

      <style jsx>{`
        @keyframes pdron-breathing {
          0% {
            transform: scale(0.96);
            filter: brightness(0.95);
          }
          100% {
            transform: scale(1.04);
            filter: brightness(1.1);
          }
        }
        @keyframes pdron-thinking-pulse {
          0% {
            transform: scale(0.92) rotate(0deg);
            filter: hue-rotate(0deg) brightness(1.1);
          }
          50% {
            transform: scale(1.08) rotate(180deg);
            filter: hue-rotate(45deg) brightness(1.3);
          }
          100% {
            transform: scale(0.94) rotate(360deg);
            filter: hue-rotate(90deg) brightness(1.1);
          }
        }
      `}</style>
    </div>
  );
}
