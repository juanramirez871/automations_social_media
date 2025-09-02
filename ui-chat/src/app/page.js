"use client";

import { useEffect, useRef, useState } from "react";
import IntroHeader from "@/components/IntroHeader";
import AssistantMessage from "@/components/AssistantMessage";
import UserMessage from "@/components/UserMessage";
import QuickActions from "@/components/QuickActions";
import UploadsList from "@/components/UploadsList";
import Composer from "@/components/Composer";

export default function Home() {
  const [messages, setMessages] = useState([
    { id: "m1", role: "assistant", type: "text", content: (
      <>
        <h2 className="font-medium text-gray-600">How can we help?</h2>
        <div className="space-y-1.5">
          <p className="mb-1.5 text-sm text-gray-600">You can ask questions like:</p>
          <ul className="list-disc list-outside space-y-1.5 ps-3.5">
            <li className="text-sm text-gray-600">What's Preline UI?</li>
            <li className="text-sm text-gray-600">How many Starter Pages &amp; Examples are there?</li>
            <li className="text-sm text-gray-600">Is there a PRO version?</li>
          </ul>
        </div>
      </>
    ) },
    { id: "m2", role: "user", type: "text", text: "what's preline ui?" },
    { id: "m3", role: "assistant", type: "text", content: (
      <>
        <p className="text-sm text-gray-600">Preline UI is an open-source set of prebuilt UI components based on the utility-first Tailwind CSS framework.</p>
        <div className="space-y-1.5">
          <p className="text-sm text-blue-500">Here're some links to get started</p>
          <ul>
            <li><a className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="https://preline.co/docs/index.html">Installation Guide</a></li>
            <li><a className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="https://preline.co/docs/frameworks.html">Framework Guides</a></li>
          </ul>
        </div>
      </>
    ) },
    { id: "m4", role: "user", type: "text", text: "what's tailwindcss?" },
    { id: "m5", role: "assistant", type: "text", content: (
      <>
        <p className="text-sm text-gray-600">Tailwind CSS is an open source CSS framework. The main feature of this library is that, unlike other CSS frameworks like Bootstrap, it does not provide a series of predefined classes for elements such as buttons or tables.</p>
        <div className="space-y-1.5">
          <ul>
            <li><a className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="#">Get started with Tailwind CSS</a></li>
            <li><a className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="#">Tailwind CSS Installation guide</a></li>
          </ul>
        </div>
      </>
    ) },
  ]);

  const bottomRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { kind, url, name }

  const handleSend = ({ text, files }) => {
    const attachments = (files || []).map((f) => {
      const isVideo = f.type?.startsWith("video/") || /\.(mp4|mov|webm|ogg|mkv|m4v)$/i.test(f.name || "");
      const kind = isVideo ? "video" : "image";
      const url = URL.createObjectURL(f);
      return { kind, url, name: f.name };
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        type: "text+media",
        text: text || "",
        attachments,
      },
    ]);
  };

  // Smooth scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onAttachmentClick = (a) => setLightbox(a);
  const closeLightbox = () => setLightbox(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-8 text-gray-600">
      <div className="max-w-4xl mx-auto">
        <IntroHeader />

        <ul className="mt-16 space-y-5">
          {messages.map((m) => {
            if (m.role === "assistant") {
              return (
                <AssistantMessage key={m.id} borderClass="border-gray-200">
                  {m.content}
                </AssistantMessage>
              );
            }
            return (
              <UserMessage key={m.id} attachments={m.attachments} onAttachmentClick={onAttachmentClick}>
                {m.text}
              </UserMessage>
            );
          })}

          <QuickActions />

          <UploadsList files={["resume_web_ui_developer.csv", "coverletter_web_ui_developer.pdf"]} />

          {/* Bottom anchor for smooth scroll */}
          <li ref={bottomRef} aria-hidden="true" />
        </ul>

        <Composer onSend={handleSend} />
      </div>

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full size-8 flex items-center justify-center shadow ring-1 ring-black/10"
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {lightbox.kind === "video" ? (
                <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-auto" />
              ) : (
                <img src={lightbox.url} alt={lightbox.name || "media"} className="max-h-[80vh] w-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
