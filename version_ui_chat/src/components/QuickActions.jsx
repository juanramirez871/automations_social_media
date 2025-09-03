"use client";

export default function QuickActions() {
  return (
    <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
      <div>
        <div className="text-end">
          <button type="button" className="mb-2.5 ms-1.5 mb-1.5 py-2 px-3 inline-flex justify-center items-center gap-x-2 rounded-lg border border-blue-300 bg-white text-blue-500 align-middle hover:bg-blue-50 focus:outline-hidden focus:bg-blue-50 text-sm">What is the use of Tailwind CSS?</button>
          <button type="button" className="mb-2.5 ms-1.5 mb-1.5 py-2 px-3 inline-flex justify-center items-center gap-x-2 rounded-lg border border-blue-300 bg-white text-blue-500 align-middle hover:bg-blue-50 focus:outline-hidden focus:bg-blue-50 text-sm">What is the difference between Tailwind CSS and CSS?</button>
        </div>
      </div>
    </li>
  );
}