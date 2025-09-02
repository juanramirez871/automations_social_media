"use client";

import { useState } from "react";
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

  const handleSend = ({ text, files }) => {
    // Build attachments from files for preview
    const attachments = (files || []).map((f) => {
      const isVideo = f.type?.startsWith("video/") || /\.(mp4|mov|webm|ogg|mkv|m4v)$/i.test(f.name || "");
      const kind = isVideo ? "video" : "image";
      // Prefer existing object URL if already created by Composer; otherwise create one
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
            // user message
            return (
              <UserMessage key={m.id} attachments={m.attachments}>
                {m.text}
              </UserMessage>
            );
          })}

          <QuickActions />

          <UploadsList files={["resume_web_ui_developer.csv", "coverletter_web_ui_developer.pdf"]} />
        </ul>

        <Composer onSend={handleSend} />
      </div>
    </div>
  );
}
