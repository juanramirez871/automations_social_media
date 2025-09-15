import { useState, useRef } from 'react';

/**
 * Hook personalizado para manejar el estado del chat
 */
export function useChatState() {
  // Estados principales
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  
  // Estados del flujo de publicación
  const [publishStage, setPublishStage] = useState('idle'); // 'idle' | 'await-media' | 'await-description'
  const [publishTargets, setPublishTargets] = useState([]);
  const [widgetTargetDrafts, setWidgetTargetDrafts] = useState({});
  const [customCaptionMode, setCustomCaptionMode] = useState(false);
  
  // Referencias
  const authGateShownRef = useRef(false);
  const bottomRef = useRef(null);
  const initialScrollDoneRef = useRef(false);
  const disableSmoothUntilRef = useRef(Date.now() + 1500);
  
  // Funciones de utilidad
  const resetPublishFlow = () => {
    setPublishStage('idle');
    setPublishTargets([]);
    setCustomCaptionMode(false);
  };
  
  const onAttachmentClick = (attachment) => {
    setLightbox(attachment);
  };
  
  const closeLightbox = () => {
    setLightbox(null);
  };
  
  return {
    // Estados
    messages,
    setMessages,
    loading,
    setLoading,
    historyLoading,
    setHistoryLoading,
    isLoggedIn,
    setIsLoggedIn,
    lightbox,
    setLightbox,
    publishStage,
    setPublishStage,
    publishTargets,
    setPublishTargets,
    widgetTargetDrafts,
    setWidgetTargetDrafts,
    customCaptionMode,
    setCustomCaptionMode,
    
    // Referencias
    authGateShownRef,
    bottomRef,
    initialScrollDoneRef,
    disableSmoothUntilRef,
    
    // Funciones
    resetPublishFlow,
    onAttachmentClick,
    closeLightbox
  };
}