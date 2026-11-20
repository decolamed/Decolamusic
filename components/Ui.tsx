'use client';
import React from 'react';

const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17l-5-5',
  library: 'M4 4v16M9 4v16M14 6l6 14',
  heart: 'M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  next: 'M6 5l10 7-10 7zM18 5v14',
  prev: 'M18 5L8 12l10 7zM6 5v14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  down: 'M6 9l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  x: 'M6 6l12 12M18 6L6 18',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0',
  dots: 'M12 5h.01M12 12h.01M12 19h.01',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  queue: 'M4 6h16M4 12h16M4 18h10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  video: 'M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3zM17 10l4-2v8l-4-2'
};

export function Icon({ n, s = 22, fill = false, className = '' }: { n: string; s?: number; fill?: boolean; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={n === 'dots' ? 3.2 : 2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={P[n]} />
    </svg>
  );
}

export function Cover({ src, size = 'w-full', className = '' }: { src?: string; size?: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={`${size} aspect-square object-cover bg-surface-3 ${className}`} />
  ) : (
    <div className={`${size} aspect-square bg-gradient-to-br from-brand-blue to-brand-orange grid place-items-center text-white/90 ${className}`}>
      <Icon n="music" s={28} />
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 grid items-end md:place-items-center" onClick={onClose}>
      <div className="bg-surface-2 w-full md:w-[420px] max-h-[80vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5 animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white"><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffa24a" /><stop offset="1" stopColor="#ff6a00" /></linearGradient></defs>
      <path d="M26 14l30-7-6 15-24 7z" fill="url(#lg)" />
      <path d="M26 24l22-5-3 8-19 5z" fill="#ff7a1a" opacity=".7" />
      <path d="M25 16v30" stroke="#1e6bff" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="17" cy="47" rx="9" ry="7" fill="#1e6bff" transform="rotate(-20 17 47)" />
    </svg>
  );
}
export function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={`flex ${big ? 'flex-col items-center gap-2' : 'items-center gap-2'}`}>
      <LogoMark size={big ? 84 : 32} />
      <div className={`font-extrabold leading-none ${big ? 'text-5xl text-center' : 'text-xl'}`}>
        Decola{big ? <br /> : ' '}<span className="text-brand-orange">Music</span>
      </div>
    </div>
  );
}

export const btnPrimary = 'bg-brand-blue hover:bg-brand-blueDark active:scale-95 transition rounded-full px-5 py-2.5 font-semibold text-white';
export const btnAccent = 'bg-brand-orange hover:brightness-110 active:scale-95 transition rounded-full px-5 py-2.5 font-semibold text-black';
export const inputCls = 'w-full bg-surface-3 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue placeholder:text-white/40';
