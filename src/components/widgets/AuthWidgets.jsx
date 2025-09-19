'use client';

import { useState } from 'react';

export const AuthGateWidget = ({ onOpen }) => {
  const openForm = mode => onOpen && onOpen(mode);

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <div className='h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400' />
        <p className='text-sm font-semibold text-gray-700'>
          Autenticación requerida
        </p>
      </div>
      <p className='text-sm text-gray-600'>Para continuar, elige una opción:</p>
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={() => openForm('login')}
          className='px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 transition cursor-pointer'
        >
          Iniciar sesión
        </button>
        <button
          type='button'
          onClick={() => openForm('signup')}
          className='px-3 py-1.5 rounded-full border border-pink-200 text-pink-700 bg-pink-50/60 hover:bg-pink-100 transition cursor-pointer'
        >
          Crear cuenta
        </button>
      </div>
      <p className='text-xs text-gray-400'>
        Demo: sin lógica de backend ni validaciones.
      </p>
    </div>
  );
};

export const AuthFormWidget = ({ mode, onLogin, onError }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [aiModel, setAiModel] = useState('gemini');
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await onLogin({ mode, name, email, pass, aiModel, apiKey });
    } catch (err) {
      onError && onError(err);
    }
  };

  const submitBtnGradient =
    'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-500/90 hover:to-blue-600/90';

  return (
    <div className='space-y-4 w-full sm:w-[34rem] md:w-[40rem]'>
      <div className='flex items-center gap-2'>
        <div className='h-1 w-8 rounded-full bg-gradient-to-r from-blue-400 to-sky-400' />
        <p className='text-sm font-semibold text-gray-700'>
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className='space-y-3'>
        {mode === 'signup' && (
          <div>
            <label className='block text-xs text-gray-600 mb-1'>Nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
              placeholder='Tu nombre'
            />
          </div>
        )}
        <div>
          <label className='block text-xs text-gray-600 mb-1'>Email</label>
          <input
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
            placeholder='tu@email.com'
          />
        </div>
        <div>
          <label className='block text-xs text-gray-600 mb-1'>Contraseña</label>
          <input
            type='password'
            value={pass}
            onChange={e => setPass(e.target.value)}
            className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
            placeholder=''
          />
        </div>
        {mode === 'signup' && (
          <div>
            <label className='block text-xs text-gray-600 mb-1'>
              Confirmar contraseña
            </label>
            <input
              type='password'
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
              placeholder=''
            />
          </div>
        )}
        {mode === 'signup' && (
          <div>
            <label className='block text-xs text-gray-600 mb-1'>
              Modelo de IA
            </label>
            <select
              value={aiModel}
              onChange={e => setAiModel(e.target.value)}
              className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
            >
              <option value='gemini'>Gemini (Google)</option>
              <option value='chatgpt'>ChatGPT (OpenAI)</option>
              <option value='deepseek'>DeepSeek</option>
            </select>
          </div>
        )}
        {mode === 'signup' && (
          <div>
            <label className='block text-xs text-gray-600 mb-1'>API Key</label>
            <input
              type='password'
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className='w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-blue-300 focus:border-blue-300'
              placeholder=''
            />
            <p className='text-xs text-gray-400 mt-1'>
              Necesaria para generar contenido con IA
            </p>
          </div>
        )}
        <button
          type='submit'
          className={`w-full inline-flex justify-center items-center rounded-lg text-white ${submitBtnGradient} px-4 py-2 text-sm cursor-pointer`}
        >
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
};
