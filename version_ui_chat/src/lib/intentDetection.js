"use client";

// Detectar intención de Instagram
export const detectInstagramIntent = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("instagram") ||
    text.includes("ig") ||
    text.includes("insta") ||
    (text.includes("cuenta") && text.includes("conectar"))
  );
};

// Detectar intención de actualizar credenciales
export const detectUpdateCredentialsIntent = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    (text.includes("actualizar") || text.includes("cambiar")) &&
    (text.includes("credenciales") ||
      text.includes("contraseña") ||
      text.includes("usuario") ||
      text.includes("cuenta"))
  );
};

// Detectar intención de Facebook
export const detectFacebookIntent = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("facebook") ||
    text.includes("fb") ||
    text.includes("face") ||
    (text.includes("cuenta") && text.includes("conectar"))
  );
};

// Detectar intención de YouTube
export const detectYouTubeIntent = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("youtube") ||
    text.includes("yt") ||
    text.includes("you tube") ||
    (text.includes("canal") && text.includes("conectar"))
  );
};

// Detectar intención de mostrar plataformas
export const showPlatformsWidgetHeuristic = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("plataformas") ||
    text.includes("redes sociales") ||
    text.includes("redes conectadas") ||
    text.includes("mis redes") ||
    text.includes("mis plataformas") ||
    text.includes("conectadas") ||
    text.includes("conectados")
  );
};

// Detectar intención de mostrar plataformas por herramienta específica
export const showPlatformsWidgetByTool = (message) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return text.includes("widget-platforms");
};