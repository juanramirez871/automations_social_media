"use client";

export default function UserMessage({ children, avatar = "AZ", bubbleClass = "bg-pink-500" }) {
  return (
    <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
      <div className="grow text-end space-y-3">
        <div className={`inline-block ${bubbleClass} rounded-lg p-4 shadow-2xs`}>
          <p className="text-sm text-white">{children}</p>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
        <span className="text-sm font-medium text-white">{avatar}</span>
      </span>
    </li>
  );
}