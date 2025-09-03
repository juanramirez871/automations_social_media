"use client";

export default function UploadsList({ files = [] }) {
  return (
    <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
      <div className="grow text-end space-y-3">
        <div className="inline-block bg-white border border-pink-100 rounded-lg p-4 space-y-3">
          <p className="text-sm text-blue-500">{files.length} files uploaded</p>
        </div>

        <ul className="flex flex-col justify-end text-start -space-y-px">
          {files.map((name) => (
            <li key={name} className="flex items-center gap-x-2 p-3 text-sm bg-white border border-gray-200 text-gray-600 first:rounded-t-lg first:mt-0 last:rounded-b-lg">
              <div className="w-full flex justify-between truncate">
                <span className="me-3 flex-1 w-0 truncate">{name}</span>
                <button type="button" className="flex items-center gap-x-2 text-gray-500 hover:text-blue-500 focus:outline-hidden focus:text-blue-500 whitespace-nowrap">
                  <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" x2="12" y1="15" y2="3"></line>
                  </svg>
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
        <span className="text-sm font-medium text-white">AZ</span>
      </span>
    </li>
  );
}