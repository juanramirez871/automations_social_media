"use client";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-pink-50 px-4 sm:px-6 lg:px-0 text-gray-600">
      <div className="max-w-4xl mx-auto pt-10">
        <h1 className="text-3xl font-bold text-blue-500 sm:text-4xl">
          ¡ Hola ! Bienvenido
        </h1>
        <p className="mt-3 text-pink-500">
            Tu asistente en tus publicaciones
        </p>

        <ul className="mt-16 space-y-5">
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
              <ellipse
                cx="19"
                cy="18.6554"
                rx="3.75"
                ry="3.6"
                fill="white"
              ></ellipse>
            </svg>

            <div className="inline-block bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="font-medium text-gray-600">How can we help?</h2>
              <div className="space-y-1.5">
                <p className="mb-1.5 text-sm text-gray-600">
                  You can ask questions like:
                </p>
                <ul className="list-disc list-outside space-y-1.5 ps-3.5">
                  <li className="text-sm text-gray-600">What's Preline UI?</li>
                  <li className="text-sm text-gray-600">
                    How many Starter Pages &amp; Examples are there?
                  </li>
                  <li className="text-sm text-gray-600">
                    Is there a PRO version?
                  </li>
                </ul>
              </div>
            </div>
          </li>

          <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
            <div className="grow text-end space-y-3">
              <div className="inline-block bg-pink-500 rounded-lg p-4 shadow-2xs">
                <p className="text-sm text-white">what's preline ui?</p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
              <span className="text-sm font-medium text-white">AZ</span>
            </span>
          </li>

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
              <ellipse
                cx="19"
                cy="18.6554"
                rx="3.75"
                ry="3.6"
                fill="white"
              ></ellipse>
            </svg>

            <div className="grow max-w-[90%] md:max-w-2xl w-full space-y-3">
              <div className="inline-block bg-white border border-pink-100 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Preline UI is an open-source set of prebuilt UI components
                  based on the utility-first Tailwind CSS framework.
                </p>
                <div className="space-y-1.5">
                  <p className="text-sm text-blue-500">
                    Here're some links to get started
                  </p>
                  <ul>
                    <li>
                      <a
                        className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium"
                        href="https://preline.co/docs/index.html"
                      >
                        Installation Guide
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-sm text-pink-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium"
                        href="https://preline.co/docs/frameworks.html"
                      >
                        Framework Guides
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div></div>
            </div>
          </li>

          <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
            <div className="grow text-end space-y-3">
              <div className="inline-block bg-pink-500 rounded-lg p-4 shadow-2xs">
                <p className="text-sm text-white">what's tailwindcss?</p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
              <span className="text-sm font-medium text-white">AZ</span>
            </span>
          </li>

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
              <ellipse
                cx="19"
                cy="18.6554"
                rx="3.75"
                ry="3.6"
                fill="white"
              ></ellipse>
            </svg>

            <div className="grow max-w-[90%] md:max-w-2xl w-full space-y-3">
              <div className="inline-block bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Tailwind CSS is an open source CSS framework. The main feature
                  of this library is that, unlike other CSS frameworks like
                  Bootstrap, it does not provide a series of predefined classes
                  for elements such as buttons or tables.
                </p>
                <div className="space-y-1.5">
                  <ul>
                    <li>
                      <a
                        className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium"
                        href="#"
                      >
                        Get started with Tailwind CSS
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-sm text-blue-500 decoration-2 hover:underline focus:outline-hidden focus:underline font-medium"
                        href="#"
                      >
                        Tailwind CSS Installation guide
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div></div>
            </div>
          </li>

          <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
            <div className="grow text-end space-y-3">
              <div className="inline-block bg-white border border-pink-100 rounded-lg p-4 space-y-3">
                <p className="text-sm text-blue-500">2 files uploaded</p>
              </div>

              <ul className="flex flex-col justify-end text-start -space-y-px">
                <li className="flex items-center gap-x-2 p-3 text-sm bg-white border border-gray-200 text-gray-600 first:rounded-t-lg first:mt-0 last:rounded-b-lg">
                  <div className="w-full flex justify-between truncate">
                    <span className="me-3 flex-1 w-0 truncate">
                      resume_web_ui_developer.csv
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-x-2 text-gray-500 hover:text-blue-500 focus:outline-hidden focus:text-blue-500 whitespace-nowrap"
                    >
                      <svg
                        className="shrink-0 size-4"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" x2="12" y1="15" y2="3"></line>
                      </svg>
                      Download
                    </button>
                  </div>
                </li>
                <li className="flex items-center gap-x-2 p-3 text-sm bg-white border border-gray-200 text-gray-600 first:rounded-t-lg first:mt-0 last:rounded-b-lg">
                  <div className="w-full flex justify-between truncate">
                    <span className="me-3 flex-1 w-0 truncate">
                      coverletter_web_ui_developer.pdf
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-x-2 text-gray-500 hover:text-blue-500 focus:outline-hidden focus:text-blue-500 whitespace-nowrap"
                    >
                      <svg
                        className="shrink-0 size-4"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" x2="12" y1="15" y2="3"></line>
                      </svg>
                      Download
                    </button>
                  </div>
                </li>
              </ul>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
              <span className="text-sm font-medium text-white">AZ</span>
            </span>
          </li>
        </ul>
      </div>

      <div className="max-w-4xl mx-auto sticky bottom-0 z-10 pt-5 pb-4 sm:pt-4 sm:pb-6 px-4 sm:px-6 lg:px-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-0">
          <div className="relative">
            <textarea
              className="p-3 sm:p-4 pb-12 sm:pb-12 block w-full border-gray-200 rounded-lg sm:text-sm focus:border-blue-300 focus:ring-blue-300 disabled:opacity-50 disabled:pointer-events-none"
              placeholder="Preguntame..."
            ></textarea>

            <div className="absolute bottom-px inset-x-px p-2 rounded-b-lg bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center">
                  <button
                    type="button"
                    className="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-blue-500 hover:bg-blue-50 focus:z-10 focus:outline-hidden focus:bg-blue-50"
                  >
                    <svg
                      className="shrink-0 size-4"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-x-1">
                  <button
                    type="button"
                    className="inline-flex shrink-0 justify-center items-center size-8 rounded-lg text-white bg-gradient-to-r from-blue-400 to-pink-400 hover:from-blue-400/90 hover:to-pink-400/90 focus:z-10 focus:outline-hidden"
                  >
                    <svg
                      className="shrink-0 size-3.5"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
