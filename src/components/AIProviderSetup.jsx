'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

const AIProviderSetup = ({
  onComplete,
  initialProvider = 'gemini',
  initialApiKey = '',
}) => {
  const [provider, setProvider] = useState(initialProvider);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const providers = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Modelo de IA avanzado de Google',
      icon: '🤖',
      placeholder: 'Ingresa tu API key de Google AI Studio',
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'Modelos GPT-3.5 y GPT-4 de OpenAI',
      icon: '🧠',
      placeholder: 'Ingresa tu API key de OpenAI',
    },
  ];

  const selectedProvider = providers.find(p => p.id === provider);

  const handleSave = async () => {
    if (!provider || !apiKey.trim()) {
      setError('Debes seleccionar un proveedor e ingresar una API key válida');

      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Actualizar configuración de IA en el perfil
      const { error: updateError } = await supabase.from('profiles').upsert({
        id: user.id,
        ai_model: provider,
        ai_api_key: apiKey.trim(),
        updated_at: new Date().toISOString(),
      });

      if (updateError) {
        throw updateError;
      }

      // Llamar callback de completado
      if (onComplete) {
        onComplete({ provider, apiKey: apiKey.trim() });
      }
    } catch (err) {
      console.error('Error saving AI configuration:', err);
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto'>
      <div className='text-center mb-6'>
        <h3 className='text-xl font-bold text-gray-900 mb-2'>
          Configurar Proveedor de IA
        </h3>
        <p className='text-gray-600 text-sm'>
          Selecciona tu proveedor de IA preferido y configura tu API key
        </p>
      </div>

      {/* Selector de Proveedor */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-gray-700 mb-3'>
          Proveedor de IA *
        </label>
        <div className='space-y-3'>
          {providers.map(prov => (
            <div
              key={prov.id}
              className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                provider === prov.id
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
                    <span className='text-lg mr-2'>{prov.icon}</span>
                    <span className='font-medium text-gray-900'>
                      {prov.name}
                    </span>
                  </div>
                  <p className='text-sm text-gray-500 mt-1'>
                    {prov.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campo API Key */}
      <div className='mb-6'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          API Key *
        </label>
        <input
          type='password'
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={selectedProvider?.placeholder}
          className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
        />
        <p className='text-xs text-gray-500 mt-1'>
          Tu API key se almacena de forma segura y encriptada
        </p>
      </div>

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
          disabled={loading || !provider || !apiKey.trim()}
          className='flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {loading ? (
            <div className='flex items-center justify-center'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
              Guardando...
            </div>
          ) : (
            'Guardar Configuración'
          )}
        </button>
      </div>

      {/* Enlaces de ayuda */}
      <div className='mt-4 text-center'>
        <p className='text-xs text-gray-500'>
          ¿Necesitas ayuda para obtener tu API key?
        </p>
        <div className='flex justify-center space-x-4 mt-2'>
          <a
            href='https://aistudio.google.com/app/apikey'
            target='_blank'
            rel='noopener noreferrer'
            className='text-xs text-blue-600 hover:text-blue-800'
          >
            🤖 Gemini API
          </a>
          <a
            href='https://platform.openai.com/api-keys'
            target='_blank'
            rel='noopener noreferrer'
            className='text-xs text-blue-600 hover:text-blue-800'
          >
            🧠 OpenAI API
          </a>
        </div>
      </div>
    </div>
  );
};

export default AIProviderSetup;
