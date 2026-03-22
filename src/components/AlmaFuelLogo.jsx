import React from 'react';

const AlmaFuelLogo = ({ size = 32, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M50 5C50 5 85 35 85 65C85 84.33 69.33 100 50 100C30.67 100 15 84.33 15 65C15 35 50 5 50 5Z" 
      fill="url(#flameGradient)"
    />
    <circle cx="50" cy="70" r="12" fill="white" fillOpacity="0.9" />
    <path 
      d="M50 45C58 55 60 65 50 75" 
      stroke="white" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeOpacity="0.6"
    />
    <defs>
      <linearGradient id="flameGradient" x1="50" y1="5" x2="50" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fb923c" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
    </defs>
  </svg>
);

export default AlmaFuelLogo;
