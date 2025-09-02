"use client";

export default function UserMessage({ children, avatar = "AZ", bubbleClass = "bg-pink-500", attachments = [], onAttachmentClick }) {
  const hasText = typeof children === "string" ? children.trim().length > 0 : Boolean(children);

  return (
    <li className="max-w-2xl ms-auto flex justify-end gap-x-2 sm:gap-x-4">
      <div className="grow text-end space-y-3">
        <div className={`inline-block ${bubbleClass} rounded-lg p-4 shadow-2xs`}>
          {hasText && (
            typeof children === "string" ? (
              <p className="text-sm text-white">{children}</p>
            ) : (
              <div className="text-sm text-white">{children}</div>
            )
          )}

          {attachments && attachments.length > 0 && (
            <div className={`mt-2 ${hasText ? "pt-1" : ""}`}>
              <div className="flex flex-wrap gap-2 justify-end">
                {attachments.map((a, idx) => (
                  <button
                    key={`${a.url}-${idx}`}
                    type="button"
                    onClick={() => onAttachmentClick?.(a)}
                    className="rounded-lg overflow-hidden border border-white/20 bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-white/50 cursor-zoom-in"
                    aria-label={`Ver ${a.kind === 'video' ? 'video' : 'imagen'} en grande`}
                  >
                    {a.kind === "video" ? (
                      <video src={a.url} className="h-24 w-24 object-cover pointer-events-none" muted />
                    ) : (
                      <img src={a.url} alt={a.name || "imagen"} className="h-24 w-24 object-cover pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center justify-center size-9.5 rounded-full bg-blue-400">
        <span className="text-sm font-medium text-white">{avatar}</span>
      </span>
    </li>
  );
}