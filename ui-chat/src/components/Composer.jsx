"use client";

export default function Composer() {
  return (
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
  );
}