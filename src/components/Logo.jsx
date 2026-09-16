import React from 'react';

export function Logo({ className = '', width = 32, height = 32 }) {
  return (
    <svg 
      className={className} 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="sphereGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#3b0764" />
        </radialGradient>
        <linearGradient id="ribbonGradFront" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="ribbonGradBack" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7e22ce" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        
        {/* Drop shadow for 3D effect */}
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5"/>
        </filter>
      </defs>
      
      {/* Ribbon Back (Behind Sphere) */}
      <path 
        d="M 68 44 C 55 46, 35 35, 33 46" 
        stroke="url(#ribbonGradBack)" 
        strokeWidth="6" 
        strokeLinecap="round" 
        fill="none"
      />
      
      {/* Central Sphere */}
      <circle cx="50" cy="50" r="22" fill="url(#sphereGrad)" filter="url(#shadow)" />
      
      {/* Ribbon Front (In front of Sphere) */}
      <path 
        d="M 33 60 C 15 65, 5 45, 25 43 C 45 41, 60 58, 75 60 C 95 62, 95 42, 75 42" 
        stroke="url(#ribbonGradFront)" 
        strokeWidth="6" 
        strokeLinecap="round" 
        fill="none" 
        filter="url(#shadow)"
      />
    </svg>
  );
}
