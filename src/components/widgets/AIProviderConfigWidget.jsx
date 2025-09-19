'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AIProviderConfigWidget = ({
  onConfigUpdate,
  onClose,
  showError = false,
}) => {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const providers = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Modelo de IA avanzado de Google',
      icon: '',
      placeholder: 'Ingresa tu API key de Google AI Studio',
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'Modelos GPT-3.5 y GPT-4 de OpenAI',
      icon: '',
      placeholder: 'Ingresa tu API key de OpenAI',
    },
  ];

  const selectedProvider = providers.find(p => p.id === provider);

  // Cargar configuración actual
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ai_model, ai_api_key')
            .eq('id', user.id)
            .single();

          if (profile) {
            setProvider(profile.ai_model || 'gemini');
            setApiKey(profile.ai_api_key || '');
          }
        }
      } catch (err) {
        console.error('Error loading AI config:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadCurrentConfig();
  }, []);

  const handleSave = async () => {
    if (!provider || !apiKey.trim()) {
      setError('Debes seleccionar un proveedor e ingresar una API key válida');

      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Actualizar configuración de IA en el perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ai_model: provider,
          ai_api_key: apiKey.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Llamar callback de actualización
      if (onConfigUpdate) {
        onConfigUpdate({ provider, apiKey: apiKey.trim() });
      }

      // Auto-cerrar después de éxito
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving AI configuration:', err);
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className='bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto'>
        <div className='flex items-center justify-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <span className='ml-3 text-gray-600'>Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg p-6 max-w-md mx-auto'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center'>
          <h3 className='text-lg font-bold text-gray-900'>
            Configuración de IA
          </h3>
        </div>
      </div>

      {/* Selector de Proveedor */}
      <div className='mb-4'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          Proveedor de IA *
        </label>
        <div className='space-y-2'>
          {providers.map(prov => (
            <div
              key={prov.id}
              className={`relative rounded-lg border p-3 cursor-pointer transition-all ${provider === prov.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setProvider(prov.id)}
            >
              <div className='flex items-center'>
                <input
                  type='radio'
                  name='provider'
                  value={prov.id}
                  checked={provider === prov.id}
                  onChange={e => setProvider(e.target.value)}
                  className='h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500'
                />
                <div className='ml-3 flex-1'>
                  <div className='flex items-center'>
                    <span className='text-base mr-2'>{prov.icon}</span>
                    <span className='font-medium text-gray-900 text-sm'>
                      {prov.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campo API Key */}
      <div className='mb-4'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          API Key *
        </label>
        <input
          type='password'
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={selectedProvider?.placeholder}
          className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
        />
      </div>

      {/* Success Message */}
      {success && (
        <div className='mb-4 p-3 bg-green-50 border border-green-200 rounded-md'>
          <div className='flex items-center'>
            <span className='text-green-500 mr-2'>✅</span>
            <p className='text-sm text-green-600'>
              Configuración actualizada correctamente
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      {/* Botones */}
      <div className='flex space-x-3'>
        <button
          onClick={handleSave}
          disabled={loading || !provider || !apiKey.trim() || success}
          className='flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm'
        >
          {loading ? (
            <div className='flex items-center justify-center'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
              Guardando...
            </div>
          ) : success ? (
            '✅ Guardado'
          ) : (
            'Actualizar Configuración'
          )}
        </button>
      </div>
    </div>
  );
};

export default AIProviderConfigWidget;
