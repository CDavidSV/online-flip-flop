import { Button } from "./button";
import Image from "next/image";
import { ComponentProps } from "react";

interface MenuButtonProps extends ComponentProps<"button"> {
    img?: string;
    text: string;
}

export default function MenuButton({ img, text, onClick, ...props }: MenuButtonProps) {
    return (
        <Button className="w-32 h-32 font-bold" variant="outline" onClick={onClick} {...props}>
            {img && <Image src={img} alt={text} width={24} height={24} />}
            {text}
        </Button>
    );
}
