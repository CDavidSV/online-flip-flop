import { Button } from "./button";
import Image from "next/image";
import { ComponentProps, ReactNode } from "react";

interface MenuButtonProps extends ComponentProps<"button"> {
    img?: string;
    icon?: ReactNode;
    text: string;
    description?: string;
    selected?: boolean;
}

export default function MenuButton({
    img,
    icon,
    text,
    description,
    selected,
    onClick,
    ...props
}: MenuButtonProps) {
    return (
        <Button
            className='group relative h-32 w-36 flex-col gap-2 whitespace-normal border-white/10 bg-white/[0.025] px-3 py-3 text-center font-semibold text-foreground shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/60 dark:hover:border-violet-400/60 hover:bg-violet-500/[0.07] hover:text-foreground hover:shadow-[0_8px_30px_-16px_rgba(139,52,255,0.65)] focus-visible:ring-violet-400'
            variant='outline'
            aria-pressed={selected}
            onClick={onClick}
            {...props}
        >
            {img && <Image src={img} alt='' width={24} height={24} />}
            {icon && <div className='text-violet-200 transition-transform duration-200 group-hover:scale-110'>{icon}</div>}
            <span>{text}</span>
            {description && (
                <span className='max-w-full px-1 pb-2 text-xs font-normal leading-4 text-muted-foreground'>
                    {description}
                </span>
            )}
        </Button>
    );
}
