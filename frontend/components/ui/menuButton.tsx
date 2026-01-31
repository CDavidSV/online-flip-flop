import { Button } from "./button";
import Image from "next/image";
import { ComponentProps, ReactNode } from "react";

interface MenuButtonProps extends ComponentProps<"button"> {
    img?: string;
    icon?: ReactNode;
    text: string;
}

export default function MenuButton({
    img,
    icon,
    text,
    onClick,
    ...props
}: MenuButtonProps) {
    return (
        <Button
            className='w-32 h-32 font-bold flex flex-col gap-2'
            variant='outline'
            onClick={onClick}
            {...props}
        >
            {img && <Image src={img} alt={text} width={24} height={24} />}
            {icon && <div>{icon}</div>}
            {text}
        </Button>
    );
}
