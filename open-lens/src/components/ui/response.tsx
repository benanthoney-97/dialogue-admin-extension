import React, { memo } from "react"
import Markdown from "markdown-to-jsx"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const Response = memo(({ className, children, ...props }: any) => {
  return (
    <div 
      className={cn(
        // Base typography styles
        "prose prose-sm max-w-none",
        // Headings
        "prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-sm",
        // Paragraphs
        "prose-p:text-gray-800 prose-p:leading-relaxed prose-p:my-1",
        // Bold/Strong
        "prose-strong:font-semibold prose-strong:text-gray-900",
        // Lists
        "prose-ul:list-disc prose-ul:pl-4 prose-ul:my-1",
        "prose-ol:list-decimal prose-ol:pl-4",
        "prose-li:my-0",
        // Code
        "prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-blue-600 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none",
        className
      )}
      {...props}
    >
      <Markdown
        options={{
          overrides: {
            // Ensure links open in new tabs if the AI generates them
            a: {
              component: (props) => (
                <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />
              ),
            },
          },
        }}
      >
        {children || ""}
      </Markdown>
    </div>
  )
})

Response.displayName = "Response"