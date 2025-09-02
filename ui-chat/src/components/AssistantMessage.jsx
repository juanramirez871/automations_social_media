"use client";

export default function AssistantMessage({ children, borderClass = "border-gray-200" }) {
  return (
    <li className="flex gap-x-2 sm:gap-x-4">
      <svg
        className="shrink-0 size-9.5 rounded-full"
        width="38"
        height="38"
        viewBox="0 0 38 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="38" height="38" rx="6" fill="#93C5FD"></rect>
        <path
          d="M10 28V18.64C10 13.8683 14.0294 10 19 10C23.9706 10 28 13.8683 28 18.64C28 23.4117 23.9706 27.28 19 27.28H18.25"
          stroke="white"
          strokeWidth="1.5"
        ></path>
        <path
          d="M13 28V18.7552C13 15.5104 15.6863 12.88 19 12.88C22.3137 12.88 25 15.5104 25 18.7552C25 22 22.3137 24.6304 19 24.6304H18.25"
          stroke="white"
          strokeWidth="1.5"
        ></path>
        <ellipse cx="19" cy="18.6554" rx="3.75" ry="3.6" fill="white"></ellipse>
      </svg>

      <div className="grow max-w-[90%] md:max-w-2xl w-full space-y-3">
        <div className={`inline-block bg-white border ${borderClass} rounded-lg p-4 space-y-3`}>
          {children}
        </div>
      </div>
    </li>
  );
}