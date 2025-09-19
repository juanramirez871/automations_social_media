'use client';

import { useState } from 'react';
import { FacebookAuthWidget } from './FacebookWidgets';

export const FacebookReconnectWidget = ({ onReconnected, onError }) => {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnected = async (payload) => {
    setIsReconnecting(false);
    if (onReconnected) {
      onReconnected(payload);
    }
  };

  const handleError = (error) => {
    setIsReconnecting(false);
    if (onError) {
      onError(error);
    }
  };

  const handleReconnectClick = () => {
    setIsReconnecting(true);
  };

  return (
    <div className='space-y-4 rounded-xl border border-red-200 bg-red-50 p-4'>
      <div className='flex items-center gap-3'>
        <div className='relative size-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center'>
          <svg viewBox='0 0 24 24' className='size-5 text-red-600' aria-hidden='true'>
            <path
              fill='currentColor'
              d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
            />
          </svg>
        </div>
        <div>
          <p className='text-sm font-semibold text-red-800'>Token de Facebook Expirado</p>
          <p className='text-xs text-red-600'>Tu sesión de Facebook ha caducado y necesita ser renovada</p>
        </div>
      </div>
      
      <div className='bg-white rounded-lg p-3 border border-red-200'>
        <p className='text-sm text-gray-700 mb-3'>
          Para continuar publicando en Facebook, necesitas reconectar tu cuenta. 
          Esto renovará automáticamente tu token de acceso.
        </p>
        
        {!isReconnecting ? (
          <button
            type='button'
            onClick={handleReconnectClick}
            className='inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-white text-sm hover:bg-[#166FE5] transition-colors cursor-pointer'
          >
            <svg viewBox='0 0 24 24' className='size-4' aria-hidden='true'>
              <path
                fill='#fff'
                d='M13.4 21v-7h2.3l.4-2.7h-2.7v-1.7c0-.8.3-1.3 1.3-1.3h1.5V5c-.3 0-1.1-.1-2.1-.1-2 0-3.4 1.2-3.4 3.5v2H8.4V14h2.3v7h2.7z'
              />
            </svg>
            Reconectar Facebook
          </button>
        ) : (
          <div className='space-y-3'>
            <FacebookAuthWidget
              widgetId={`facebook-reconnect-${Date.now()}`}
              onConnected={handleReconnected}
              onError={handleError}
            />
          </div>
        )}
      </div>
    </div>
  );
};