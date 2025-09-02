"use client";

import IntroHeader from "@/components/IntroHeader";
import AssistantMessage from "@/components/AssistantMessage";
import UserMessage from "@/components/UserMessage";
import QuickActions from "@/components/QuickActions";
import UploadsList from "@/components/UploadsList";
import Composer from "@/components/Composer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-8 text-gray-600">
      <div className="max-w-4xl mx-auto">
        <IntroHeader />

        <ul className="mt-16 space-y-5">
          <AssistantMessage borderClass="border-gray-200">
            <h2 className="font-medium text-gray-600">How can we help?</h2>
            <div className="space-y-1.5">
              <p className="mb-1.5 text-sm text-gray-600">You can ask questions like:</p>
              <ul className="list-disc list-outside space-y-1.5 ps-3.5">
                <li className="text-sm text-gray-600">What's Preline UI?</li>
                <li className="text-sm text-gray-600">How many Starter Pages &amp; Examples are there?</li>
                <li className="text-sm text-gray-600">Is there a PRO version?</li>
              </ul>
            </div>
          </AssistantMessage>

          <UserMessage>what's preline ui?</UserMessage>

          <AssistantMessage borderClass="border-pink-100">
            <p className="text-sm text-gray-600">Preline UI is an open-source set of prebuilt UI components based on the utility-first Tailwind CSS framework.</p>
            <div className="space-y-1.5">
              <p className="text-sm text-blue-500">Here're some links to get started</p>
              <ul>
                <li><a className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="https://preline.co/docs/index.html">Installation Guide</a></li>
                <li><a className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="https://preline.co/docs/frameworks.html">Framework Guides</a></li>
              </ul>
            </div>
          </AssistantMessage>

          <UserMessage>what's tailwindcss?</UserMessage>

          <AssistantMessage borderClass="border-gray-200">
            <p className="text-sm text-gray-600">Tailwind CSS is an open source CSS framework. The main feature of this library is that, unlike other CSS frameworks like Bootstrap, it does not provide a series of predefined classes for elements such as buttons or tables.</p>
            <div className="space-y-1.5">
              <ul>
                <li><a className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="#">Get started with Tailwind CSS</a></li>
                <li><a className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium" href="#">Tailwind CSS Installation guide</a></li>
              </ul>
            </div>
          </AssistantMessage>

          <QuickActions />

          <UploadsList files={["resume_web_ui_developer.csv", "coverletter_web_ui_developer.pdf"]} />
        </ul>

        <Composer />
      </div>
    </div>
  );
}
