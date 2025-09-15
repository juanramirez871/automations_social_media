"use client";

import { useState } from "react";

export default function CalendarModal({ isOpen, onClose }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [improvingText, setImprovingText] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [newPost, setNewPost] = useState(null);
  const [improvingNewText, setImprovingNewText] = useState(false);
  
  // Datos mock iniciales de publicaciones programadas
  const [scheduledPosts, setScheduledPosts] = useState(() => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    return {
    [`${year}-${month}-15`]: [
      { time: '09:00', platforms: ['Instagram', 'Facebook'], content: 'Post matutino' },
      { time: '18:00', platforms: ['TikTok'], content: 'Video viral' }
    ],
    [`${year}-${month}-20`]: [
      { time: '12:00', platforms: ['YouTube'], content: 'Tutorial semanal' }
    ],
    [`${year}-${month}-25`]: [
      { time: '14:30', platforms: ['Instagram', 'TikTok'], content: 'Contenido colaborativo' },
      { time: '19:00', platforms: ['Facebook', 'YouTube'], content: 'Live stream' }
    ],
    [`${year}-${month}-28`]: [
       { time: '10:15', platforms: ['Instagram'], content: 'Stories del día' }
     ]
    };
  });

  if (!isOpen) return null;

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const getPostsForDay = (day) => {
    const key = `${year}-${month}-${day}`;
    return scheduledPosts[key] || [];
  };
  
  const getPlatformColor = (platform) => {
    const colors = {
      'Instagram': 'bg-pink-500',
      'Facebook': 'bg-blue-600',
      'YouTube': 'bg-red-500',
      'TikTok': 'bg-black'
    };
    return colors[platform] || 'bg-gray-500';
  };
  
  const deletePost = (day, postIndex) => {
    const key = `${year}-${month}-${day}`;
    setScheduledPosts(prev => {
      const newPosts = { ...prev };
      if (newPosts[key]) {
        newPosts[key] = newPosts[key].filter((_, idx) => idx !== postIndex);
        if (newPosts[key].length === 0) {
          delete newPosts[key];
        }
      }
      return newPosts;
    });
  };
  
  const startEdit = (day, postIndex) => {
    const key = `${year}-${month}-${day}`;
    const post = scheduledPosts[key]?.[postIndex];
    if (post) {
      setEditingPost({
        originalDay: day,
        originalIndex: postIndex,
        day: day,
        time: post.time,
        platforms: [...post.platforms],
        content: post.content
      });
    }
  };
  
  const saveEdit = () => {
    if (!editingPost) return;
    
    const oldKey = `${year}-${month}-${editingPost.originalDay}`;
    const newKey = `${year}-${month}-${editingPost.day}`;
    
    setScheduledPosts(prev => {
      const newPosts = { ...prev };
      
      // Eliminar el post original
      if (newPosts[oldKey]) {
        newPosts[oldKey] = newPosts[oldKey].filter((_, idx) => idx !== editingPost.originalIndex);
        if (newPosts[oldKey].length === 0) {
          delete newPosts[oldKey];
        }
      }
      
      // Agregar el post editado
      if (!newPosts[newKey]) {
        newPosts[newKey] = [];
      }
      newPosts[newKey].push({
        time: editingPost.time,
        platforms: editingPost.platforms,
        content: editingPost.content
      });
      
      // Ordenar por hora
      newPosts[newKey].sort((a, b) => a.time.localeCompare(b.time));
      
      return newPosts;
    });
    
    setEditingPost(null);
    setSelectedDay(editingPost.day);
  };
  
  const cancelEdit = () => {
    setEditingPost(null);
  };
  
  const togglePlatform = (platform) => {
    if (!editingPost) return;
    setEditingPost(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };
  
  const improveTextWithAI = async () => {
    if (!editingPost?.content?.trim() || improvingText) return;
    
    setImprovingText(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: editingPost.content }],
          mode: 'caption'
        })
      });
      
      if (!response.ok) throw new Error('Error al mejorar el texto');
      
      const data = await response.json();
      if (data.text) {
        setEditingPost(prev => ({ ...prev, content: data.text }));
      }
    } catch (error) {
      console.error('Error mejorando texto:', error);
      // Aquí podrías mostrar un toast o mensaje de error
    } finally {
      setImprovingText(false);
    }
  };
  
  const startCreatePost = (day = null) => {
    const targetDay = day || selectedDay || today.getDate();
    const targetDate = new Date(year, month, targetDay);
    const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    setNewPost({
      date: dateString,
      time: '12:00',
      platforms: ['Instagram'],
      content: ''
    });
    setCreatingPost(true);
  };
  
  const saveNewPost = () => {
    if (!newPost || !newPost.content.trim() || newPost.platforms.length === 0) return;
    
    const selectedDate = new Date(newPost.date);
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    const key = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    setScheduledPosts(prev => {
      const newPosts = { ...prev };
      if (!newPosts[key]) {
        newPosts[key] = [];
      }
      newPosts[key].push({
        time: newPost.time,
        platforms: newPost.platforms,
        content: newPost.content
      });
      
      // Ordenar por hora
      newPosts[key].sort((a, b) => a.time.localeCompare(b.time));
      
      return newPosts;
    });
    
    setCreatingPost(false);
    setNewPost(null);
    
    // Si la fecha seleccionada es del mes actual, seleccionar el día
    if (selectedYear === year && selectedMonth === month) {
      setSelectedDay(selectedDay);
    }
  };
  
  const cancelCreatePost = () => {
    setCreatingPost(false);
    setNewPost(null);
  };
  
  const toggleNewPostPlatform = (platform) => {
    if (!newPost) return;
    setNewPost(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }));
  };
  
  const improveNewTextWithAI = async () => {
    if (!newPost?.content?.trim() || improvingNewText) return;
    
    setImprovingNewText(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: newPost.content }],
          mode: 'caption'
        })
      });
      
      if (!response.ok) throw new Error('Error al mejorar el texto');
      
      const data = await response.json();
      if (data.text) {
        setNewPost(prev => ({ ...prev, content: data.text }));
      }
    } catch (error) {
      console.error('Error mejorando texto:', error);
    } finally {
      setImprovingNewText(false);
    }
  };
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const renderCalendarDays = () => {
    const days = [];
    
    // Días vacíos al inicio
    for (let i = 0; i < firstDayWeekday; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const posts = getPostsForDay(day);
      const hasScheduled = posts.length > 0;
      
      days.push(
        <div
          key={day}
          onClick={() => setSelectedDay(selectedDay === day ? null : day)}
          className={`p-2 text-center text-sm cursor-pointer hover:bg-blue-50 hover:shadow-sm rounded-lg relative transition-all duration-200 min-h-[40px] flex flex-col justify-center ${
            isToday ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-md' : 'text-gray-700'
          } ${hasScheduled ? 'ring-1 ring-green-400 bg-green-50' : 'bg-white'} ${selectedDay === day ? 'ring-1 ring-blue-500 bg-blue-100' : ''}`}
        >
          <div className="relative">
            <span className="text-sm font-medium">{day}</span>
            {hasScheduled && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                <div className="flex gap-0.5">
                  {posts.slice(0, 3).map((post, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  ))}
                  {posts.length > 3 && (
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-4 w-4/5 h-4/5 max-w-5xl max-h-screen overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">📅 Calendario</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startCreatePost()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 bg-green-50 hover:bg-green-100 rounded-lg cursor-pointer transition-colors"
              title="Nueva Publicación"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Nueva
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all cursor-pointer"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Header del calendario */}
        <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-white hover:shadow-md rounded-lg cursor-pointer transition-all duration-200"
            aria-label="Mes anterior"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h4 className="text-lg font-bold text-gray-800">
            {monthNames[month]} {year}
          </h4>
          
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-white hover:shadow-md rounded-lg cursor-pointer transition-all duration-200"
            aria-label="Mes siguiente"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {dayNames.map(day => (
            <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 bg-gray-50 rounded">
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {renderCalendarDays()}
        </div>

        {/* Leyenda */}
        <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Leyenda</h5>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded shadow-sm"></div>
              <span className="text-blue-800 font-medium">Hoy</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border border-green-400 bg-green-50 rounded"></div>
              <span className="text-green-800 font-medium">Con posts</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-green-800 font-medium">= 1 post</span>
            </div>
          </div>
        </div>

        {/* Detalles del día seleccionado */}
        {selectedDay && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <h5 className="font-medium text-gray-900 mb-2">
              Publicaciones del {selectedDay} de {monthNames[month]}
            </h5>
            {getPostsForDay(selectedDay).length > 0 ? (
               <div className="space-y-2">
                 {getPostsForDay(selectedDay).map((post, idx) => (
                   <div key={idx} className="bg-white p-2 rounded border-l-4 border-green-500">
                     <div className="flex items-center justify-between mb-1">
                       <span className="text-sm font-medium text-gray-900">{post.time}</span>
                       <div className="flex items-center gap-2">
                         <div className="flex gap-1">
                           {post.platforms.map((platform, pIdx) => (
                             <span
                               key={pIdx}
                               className={`px-2 py-0.5 text-xs text-white rounded-full ${getPlatformColor(platform)}`}
                             >
                               {platform}
                             </span>
                           ))}
                         </div>
                         <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(selectedDay, idx)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deletePost(selectedDay, idx)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg cursor-pointer transition-colors"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                       </div>
                     </div>
                     <p className="text-xs text-gray-600">{post.content}</p>
                   </div>
                 ))}
               </div>
            ) : (
              <p className="text-sm text-gray-500">No hay publicaciones programadas para este día.</p>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={goToToday}
            className="flex-1 px-4 py-2 text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow cursor-pointer"
          >
            🏠 Hoy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow cursor-pointer"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>
      
      {/* Modal de edición */}
         {editingPost && (
           <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60" onClick={cancelEdit}>
             <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-gray-900">Editar Publicación</h3>
                 <button
                   type="button"
                   onClick={cancelEdit}
                   className="text-gray-400 hover:text-gray-600 cursor-pointer"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
            
            <div className="space-y-4">
              {/* Día */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Día</label>
                <select
                  value={editingPost.day}
                  onChange={(e) => setEditingPost(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              
              {/* Hora */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={editingPost.time}
                  onChange={(e) => setEditingPost(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Plataformas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plataformas</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Instagram', 'Facebook', 'YouTube', 'TikTok'].map(platform => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer ${
                        editingPost.platforms.includes(platform)
                          ? `${getPlatformColor(platform)} text-white border-transparent`
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Contenido */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
                <textarea
                  value={editingPost.content}
                  onChange={(e) => setEditingPost(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Descripción del post..."
                />
                <button
                  type="button"
                  onClick={improveTextWithAI}
                  disabled={!editingPost?.content?.trim() || improvingText}
                  className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Mejorar texto con IA"
                >
                  {improvingText ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      Mejorando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      ✨ Mejorar con IA
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editingPost.platforms.length === 0 || !editingPost.content.trim()}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
         )}
         
         {/* Modal de nueva publicación */}
         {creatingPost && newPost && (
           <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60" onClick={cancelCreatePost}>
             <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-gray-900">Nueva Publicación</h3>
                 <button
                   type="button"
                   onClick={cancelCreatePost}
                   className="text-gray-400 hover:text-gray-600 cursor-pointer"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                 </button>
               </div>
               
               <div className="space-y-4">
                  {/* Fecha */}
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                     <input
                        type="date"
                        value={newPost?.date || ''}
                        onChange={(e) => setNewPost(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min={new Date().toISOString().split('T')[0]}
                      />
                   </div>
                 
                 {/* Hora */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                   <input
                     type="time"
                     value={newPost.time}
                     onChange={(e) => setNewPost(prev => ({ ...prev, time: e.target.value }))}
                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   />
                 </div>
                 
                 {/* Plataformas */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Plataformas</label>
                   <div className="grid grid-cols-2 gap-2">
                     {['Instagram', 'Facebook', 'YouTube', 'TikTok'].map(platform => (
                       <button
                         key={platform}
                         type="button"
                         onClick={() => toggleNewPostPlatform(platform)}
                         className={`px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer ${
                           newPost.platforms.includes(platform)
                             ? `${getPlatformColor(platform)} text-white border-transparent`
                             : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                         }`}
                       >
                         {platform}
                       </button>
                     ))}
                   </div>
                 </div>
                 
                 {/* Contenido */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
                    <textarea
                      value={newPost.content}
                      onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Descripción del post..."
                    />
                    <button
                      type="button"
                      onClick={improveNewTextWithAI}
                      disabled={!newPost?.content?.trim() || improvingNewText}
                      className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mejorar texto con IA"
                    >
                      {improvingNewText ? (
                        <>
                          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          Mejorando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          ✨ Mejorar con IA
                        </>
                      )}
                    </button>
                  </div>
               </div>
               
               <div className="flex gap-3 mt-6">
                 <button
                   type="button"
                   onClick={cancelCreatePost}
                   className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                 >
                   Cancelar
                 </button>
                 <button
                   type="button"
                   onClick={saveNewPost}
                   disabled={newPost.platforms.length === 0 || !newPost.content.trim()}
                   className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Crear Publicación
                 </button>
               </div>
             </div>
           </div>
         )}
      </div>
    );
  }