'use client';

export default function AssistantMessage({
  children,
  borderClass = 'border-gray-200',
}) {
  return (
    <li className='flex gap-x-2 sm:gap-x-4'>
      <img
      src="https://storage.googleapis.com/wtl/w/398/icon8472.png"
      alt="logo"
      className='shrink-0 size-9.5 rounded-full'
       />

      <div className='grow max-w-[90%] md:max-w-2xl w-full space-y-3'>
        <div
          className={`inline-block bg-white border ${borderClass} rounded-lg p-4 space-y-3`}
        >
          {children}
        </div>
      </div>
    </li>
  );
}
