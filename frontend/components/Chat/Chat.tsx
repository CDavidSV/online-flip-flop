import { MessageSquare, Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useWebSocket } from "@/context/wsContext";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { ChatMessage, MessageEvent } from "@/types/types";
import { useGameRoom } from "@/context/roomContext";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";

export function Chat({ initialMessages }: { initialMessages?: ChatMessage[] }) {
    const { clientId, isConnected, on, sendRequest } = useWebSocket();
    const { isSpectator } = useGameRoom();

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
        initialMessages || [],
    );
    const [messageInput, setMessageInput] = useState("");

    const bottomChatRef = useRef<HTMLSpanElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = () => {
        if (!isConnected || !clientId) return;

        const messageCotent = messageInput.trim();
        if (messageCotent === "") return;

        setMessageInput("");

        sendRequest("message", { content: messageCotent })
            .then(() => {
                setChatMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        client_id: clientId,
                        username: "You",
                        message: messageCotent,
                    },
                ]);
            })
            .catch((error) => {
                console.error("Error sending message:", error);
            });
    };

    const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleSendMessage();
        }
    };

    const onMessageReceived = useCallback((msg: MessageEvent) => {
        const newMessage = {
            client_id: msg.clientId,
            username: msg.username,
            message: msg.message,
        };
        setChatMessages((prevMessages) => [...prevMessages, newMessage]);
    }, []);

    useEffect(() => {
        if (isConnected && clientId) {
            const cleanup = on("chat", onMessageReceived);
            return cleanup;
        }
    }, [isConnected, clientId, on, onMessageReceived]);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [chatMessages]);

    return (
        <Card className='flex flex-col gap-0 overflow-hidden rounded-lg border-white/10 bg-white/[0.025] py-0 shadow-[0_14px_42px_-30px_rgba(0,0,0,0.85)] md:min-h-80 md:flex-1'>
            <CardHeader className='gap-0 border-b border-white/[0.07] px-4 py-4'>
                    <CardTitle className='flex items-center text-sm font-semibold text-slate-100'>
                        <MessageSquare size={16} className='mr-2 text-violet-300' />
                    {isSpectator ? "Spectator Chat" : "Game Chat"}
                </CardTitle>
            </CardHeader>
            <CardContent className='h-[320px] p-0 md:min-h-0 md:flex-1'>
                <ScrollArea className='h-full px-3 py-4' viewportRef={viewportRef}>
                    <div className='flex flex-col space-y-3'>
                        {chatMessages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${
                                    msg.client_id === clientId
                                        ? "justify-end"
                                        : "justify-start"
                                }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
                                        msg.client_id === clientId
                                            ? "rounded-br-sm border-violet-300/25 bg-violet-600/25 text-violet-50"
                                            : "rounded-tl-sm border-red-300/20 bg-red-500/10 text-red-50"
                                    }`}
                                >
                                    <strong className='block text-xs mb-0.5 opacity-80'>
                                        {msg.client_id === clientId
                                            ? "You"
                                            : msg.username}
                                    </strong>
                                    <p className='wrap-anywhere'>
                                        {msg.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <span ref={bottomChatRef}></span>
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className='!border-t !border-white/[0.08] !p-3'>
                <div className='flex w-full gap-2'>
                    <Input
                        placeholder='Type a message...'
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className='min-w-0 flex-1 border-white/10 bg-black/25 placeholder:text-slate-500 focus-visible:border-violet-400 focus-visible:ring-violet-400/25'
                    />
                    <Button
                        aria-label='Send message'
                        onClick={handleSendMessage}
                        disabled={messageInput.trim() === ""}
                        className='bg-violet-600 text-white hover:bg-violet-500'
                    >
                        <Send size={18} />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
