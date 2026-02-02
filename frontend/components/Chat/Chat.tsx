import { MessageSquare, Send } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useWebSocket } from "@/context/wsContext";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ChatMessage, MessageEvent } from "@/types/types";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "../ui/card";
import { useGameRoom } from "@/context/roomContext";

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

    const onMessageReceived = (msg: MessageEvent) => {
        const newMessage = {
            client_id: msg.clientId,
            username: msg.username,
            message: msg.message,
        };

        setChatMessages((prevMessages) => [...prevMessages, newMessage]);
    };

    useEffect(() => {
        if (isConnected && clientId) {
            const cleanup = on("chat", onMessageReceived);
            return cleanup;
        }
    }, [isConnected, clientId, on]);

    useEffect(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [chatMessages]);

    return (
        <Card className='flex-shrink-0 md:flex-1 md:min-h-0 flex flex-col pt-6 pb-0'>
            <CardHeader>
                <CardTitle className='flex items-center text-base'>
                    <MessageSquare size={16} className='mr-2' />
                    {isSpectator ? "Spectator Chat" : "Game Chat"}
                </CardTitle>
            </CardHeader>
            <CardContent className='p-0 h-[400px] md:flex-1 md:min-h-0'>
                <ScrollArea className='h-full p-4' viewportRef={viewportRef}>
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
                                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm shadow-md ${
                                        msg.client_id === clientId
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-tl-none"
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
            <CardFooter className='!p-4 border-t border-gray-100 dark:border-gray-700'>
                <div className='flex w-full space-x-2'>
                    <Input
                        placeholder='Type a message...'
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className='flex-1 rounded-lg'
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={messageInput.trim() === ""}
                    >
                        <Send size={18} />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
