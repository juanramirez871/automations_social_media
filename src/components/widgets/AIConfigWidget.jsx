import { useState, useEffect } from 'react';
import { getSessionOnce } from '@/lib/sessionUtils';
import { getAvailableProviders } from '@/lib/aiProviders';

export function AIConfigWidget({ onConfigUpdate }) {
  const [currentProvider, setCurrentProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const providers = getAvailableProviders();

  // Cargar configuración actual
  useEffect(() => {
    loadCurrentConfig();
  }, []);

  const loadCurrentConfig = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await getSessionOnce();
      const userId = sessionData?.session?.user?.id;

      if (!userId) return;

      const response = await fetch(`/api/ai-config`);

      if (response.ok) {
        const data = await response.json();

        setCurrentProvider(data.provider || 'gemini');
        setApiKey('');
      }
    } catch (error) {
      console.error('Error loading AI config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');

      const { data: sessionData } = await getSessionOnce();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setMessage('Error: Usuario no autenticado');

        return;
      }

      const response = await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          provider: currentProvider,
          apiKey: apiKey.trim() || null,
        }),
      });

      if (response.ok) {
        setMessage('Configuración guardada exitosamente');
        if (onConfigUpdate) {
          onConfigUpdate(currentProvider, apiKey);
        }
      } else {
        const error = await response.json();

        setMessage(`❌ Error: ${error.message || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('Error saving AI config:', error);
      setMessage('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const selectedProvider = providers.find(p => p.id === currentProvider);

  if (loading) {
    return (
      <div className='bg-white rounded-lg border border-gray-200 p-6'>
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-200 rounded w-1/4 mb-4'></div>
          <div className='h-10 bg-gray-200 rounded mb-4'></div>
          <div className='h-4 bg-gray-200 rounded w-3/4'></div>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg border border-gray-200 p-6'>
      <div className='flex items-center gap-3 mb-4'>
        <div className='w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center'>
          <span className='text-purple-600 text-lg'>🤖</span>
        </div>
        <div>
          <h3 className='font-semibold text-gray-900'>Configuración de IA</h3>
          <p className='text-sm text-gray-600'>
            Elige tu proveedor de inteligencia artificial
          </p>
        </div>
      </div>

      {/* Selector de proveedor */}
      <div className='mb-4'>
        <label className='block text-sm font-medium text-gray-700 mb-2'>
          Proveedor de IA
        </label>
        <div className='space-y-2'>
          {providers.map(provider => (
            <label
              key={provider.id}
              className='flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50'
            >
              <input
                type='radio'
                name='provider'
                value={provider.id}
                checked={currentProvider === provider.id}
                onChange={e => setCurrentProvider(e.target.value)}
                className='mt-1 text-blue-600'
              />
              <div className='flex-1'>
                <div className='font-medium text-gray-900'>{provider.name}</div>
                <div className='text-sm text-gray-600'>
                  {provider.description}
                </div>
                {provider.requiresApiKey && (
                  <div className='text-xs text-amber-600 mt-1'>
                    ⚠️ Requiere API Key propia
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Campo API Key */}
      {selectedProvider?.requiresApiKey && (
        <div className='mb-4'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            API Key para {selectedProvider.name}
          </label>
          <div className='relative'>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={`Ingresa tu API Key de ${selectedProvider.name}`}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10'
            />
            <button
              type='button'
              onClick={() => setShowApiKey(!showApiKey)}
              className='absolute right-2 top-2 text-gray-400 hover:text-gray-600'
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
          <p className='text-xs text-gray-500 mt-1'>
            Tu API Key se almacena de forma segura y solo tú puedes verla
          </p>
        </div>
      )}

      {/* Información del modelo actual */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4'>
        <div className='text-sm'>
          <span className='font-medium text-blue-900'>Modelo actual:</span>
          <span className='text-blue-700 ml-1'>
            {selectedProvider?.name} ({selectedProvider?.defaultModel})
          </span>
        </div>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div
          className={`p-3 rounded-lg mb-4 text-sm ${message.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }`}
        >
          {message}
        </div>
      )}

      {/* Botones */}
      <div className='flex gap-3'>
        <button
          onClick={handleSave}
          disabled={
            saving || (selectedProvider?.requiresApiKey && !apiKey.trim())
          }
          className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {saving ? (
            <span className='flex items-center justify-center gap-2'>
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
              Guardando...
            </span>
          ) : (
            'Guardar Configuración'
          )}
        </button>

        <button
          onClick={loadCurrentConfig}
          disabled={loading}
          className='px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors'
        >
          🔄 Recargar
        </button>
      </div>

      {/* Ayuda */}
      <div className='mt-4 p-3 bg-gray-50 rounded-lg'>
        <h4 className='font-medium text-gray-900 mb-2'>💡 Información</h4>
        <ul className='text-sm text-gray-600 space-y-1'>
          <li>
            • <strong>Gemini:</strong> Gratuito con límites, no requiere API Key
          </li>
          <li>
            • <strong>ChatGPT:</strong> Requiere cuenta OpenAI y API Key
          </li>
          <li>
            • <strong>DeepSeek:</strong> Económico, requiere cuenta y API Key
          </li>
        </ul>
      </div>
    </div>
  );
}
