import React from 'react';

const AlmaFuelLogo = ({ size = 32, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 10px rgba(249, 115, 22, 0.4))' }}
  >
    {/* Outer Flame */}
    <path 
      d="M50 5C50 5 88 35 88 65C88 86 71 100 50 100C29 100 12 86 12 65C12 35 50 5 50 5Z" 
      fill="url(#outerGradient)"
    />
    {/* Inner Dark Flame/Drop */}
    <path 
      d="M50 40C50 40 72 58 72 75C72 87 62 96 50 96C38 96 28 87 28 75C28 58 50 40 50 40Z" 
      fill="#0f172a" 
      fillOpacity="0.8"
    />
    {/* Shining Center Drop */}
    <path 
      d="M50 68C50 68 62 78 62 85C62 91 57 95 50 95C43 95 38 91 38 85C38 78 50 68 50 68Z" 
      fill="white"
      fillOpacity="0.95"
    />
    <defs>
      <linearGradient id="outerGradient" x1="50" y1="5" x2="50" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f97316" />
        <stop offset="1" stopColor="#9a3412" />
      </linearGradient>
    </defs>
  </svg>
);

export default AlmaFuelLogo;
