'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useTheme } from '@/lib/ThemeContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'full' | 'icon';
  className?: string;
  forceTheme?: 'dark' | 'light';
}

export default function MistikaLogo({ size = 'md', variant = 'full', className = '', forceTheme }: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const { theme } = useTheme();

  const currentTheme = forceTheme || theme || 'dark';

  // Dynamic logos according to user specifications
  const darkLogoUrl = 'https://curso.curtatche.com.br/logocoaet_preto.png';
  const lightLogoUrl = 'https://curso.curtatche.com.br/logo_coaet.png';
  const iconUrl = 'https://curso.curtatche.com.br/icone_coaet.png';

  const logoUrl = currentTheme === 'light' ? lightLogoUrl : darkLogoUrl;

  if (variant === 'icon') {
    const iconDimensions = {
      sm: 'size-10',
      md: 'size-14',
      lg: 'size-20',
      xl: 'size-28',
      '2xl': 'size-36',
    }[size];

    return (
      <div className={`relative flex items-center justify-center ${iconDimensions} ${className}`}>
        {!imgError ? (
          <Image
            src={iconUrl}
            alt="Canva com IA Icone"
            fill
            className="object-contain"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            priority
          />
        ) : (
          <div className="size-full rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
            C
          </div>
        )}
      </div>
    );
  }

  const containerSizes = {
    sm: 'h-12 w-44 sm:h-14 sm:w-52',
    md: 'h-16 w-60 sm:h-20 sm:w-72 md:h-24 md:w-80',
    lg: 'h-24 w-80 sm:h-28 sm:w-96 md:h-32 md:w-[420px]',
    xl: 'h-32 w-96 sm:h-40 sm:w-[480px] md:h-48 md:w-[540px]',
    '2xl': 'h-44 w-[480px] sm:h-56 sm:w-[600px] md:h-64 md:w-[700px]',
  }[size];

  return (
    <div className={`relative flex items-center select-none ${containerSizes} ${className}`}>
      {!imgError ? (
        <Image
          key={logoUrl}
          src={logoUrl}
          alt="Canva com IA - O Desafio"
          fill
          className="object-contain"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          priority
        />
      ) : (
        <div className="flex flex-col justify-center">
          <span className="font-display font-semibold tracking-wider text-slate-900 dark:text-slate-100 text-lg leading-tight">
            Canva com IA
          </span>
          <span className="text-[9px] font-bold tracking-[0.25em] text-accent-gold uppercase opacity-90">
            O Desafio
          </span>
        </div>
      )}
    </div>
  );
}
