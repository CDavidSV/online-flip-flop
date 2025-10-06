"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

const PInput = React.forwardRef<
    HTMLInputElement,
    React.ComponentProps<"input">
>(({ className, ...props }, ref) => {
    const [type, setType] = React.useState<"password" | "text">("password");

    return (
        <div className='relative flex items-center'>
            <input
                type={type}
                className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent pr-10 pl-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    className
                )}
                ref={ref}
                {...props}
            />
            <button
                type="button"
                className='cursor-pointer absolute right-3'
                onClick={() => setType((type) => type === "text" ? "password" : "text")}
            >
                {type === "password" ? (
                    <EyeOff size={20} className='text-muted-foreground' />
                ) : (
                    <Eye
                        size={20}
                        className='text-muted-foreground'
                    />
                )}
            </button>
        </div>
    );
});
PInput.displayName = "Input";

export { PInput };
