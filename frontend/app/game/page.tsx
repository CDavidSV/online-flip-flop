"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Send, MessageSquare, Check, Flag } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";

const MOCK_ROOM_ID = "Adh3t4";

const initialMoves = [
    { id: 1, player: 1, notation: "e1-e4" },
    { id: 2, player: 2, notation: "e5-e3" },
    { id: 3, player: 1, notation: "a1-a4" },
    { id: 4, player: 2, notation: "a7-a3" },
];

const initialChat = [
    { id: 1, player: "User1", text: "Good game" },
    {
        id: 2,
        player: "User2",
        text: "This was a very good game! Looking forward to our next match.",
    },
];

const App = () => {
    const [moves, setMoves] = useState(initialMoves);
    const [chatMessages, setChatMessages] = useState(initialChat);
    const [messageInput, setMessageInput] = useState("");
    const [copied, setCopied] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of chat whenever messages update
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTo({
                top: chatRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [chatMessages]);

    const copyRoomId = () => {
        console.log(`Copied ID: ${MOCK_ROOM_ID}`);
        const textarea = document.createElement("textarea");
        textarea.value = MOCK_ROOM_ID;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            navigator.clipboard.writeText(MOCK_ROOM_ID);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
        document.body.removeChild(textarea);
    };

    const handleForfeit = () => {};

    const handleSendMessage = () => {};

    const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleSendMessage();
        }
    };

    return (
        <div className='md:flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-inter p-4 gap-4'>
            {/* Main Game Area */}
            <div className='md:flex flex-1 mb-4 md:mb-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 flex-col items-center justify-between overflow-hidden'>
                <div className='flex items-center text-lg font-semibold text-red-500 dark:text-red-400 mb-4'>
                    PLAYER 2 (OPPONENT)
                </div>

                <div className='flex items-center justify-center w-full max-w-[80vh] and max-h-[80vh] aspect-square bg-gray-200 dark:bg-gray-700 rounded-xl shadow-inner border-4 border-gray-300 dark:border-gray-600 p-2'>
                    <div className='text-xl text-gray-500 dark:text-gray-400 font-bold p-8 text-center'>
                        [BOARD GAME RENDERING HERE]
                    </div>
                </div>

                <div className='flex items-center text-lg font-semibold text-blue-600 dark:text-blue-400 mt-4'>
                    PLAYER 1 (YOU)
                </div>
            </div>

            <div className='flex flex-col w-full md:w-96 gap-4 mb-4 md:mb-0'>
                <Card className='flex-shrink-0'>
                    <CardHeader>
                        <CardTitle className='flex items-center justify-between'>
                            Game Room
                            <Badge variant='secondary'>In Progress</Badge>
                        </CardTitle>
                        <CardDescription className='text-sm'>
                            Share this ID to invite a friend.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-3'>
                        <div className='flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-lg'>
                            <span className='font-mono text-base truncate'>
                                {MOCK_ROOM_ID}
                            </span>
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={copyRoomId}
                                className='ml-2 w-8 h-8 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-600'
                            >
                                {copied ? (
                                    <Check
                                        size={16}
                                        className='text-green-500'
                                    />
                                ) : (
                                    <Copy size={16} />
                                )}
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter className='pt-0'>
                        <Button
                            onClick={handleForfeit}
                            variant='destructive'
                            className='w-full text-white rounded-lg transition-all shadow-md hover:shadow-lg hover:scale-[1.01]'
                        >
                            <Flag size={18} className='mr-2' />
                            Forfeit Game
                        </Button>
                    </CardFooter>
                </Card>

                {/* Move History Card */}
                <Card className='flex-shrink-0'>
                    <CardHeader>
                        <CardTitle className='text-base'>
                            Move History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='h-48 p-0'>
                        <ScrollArea className='h-full rounded-md'>
                            <div className='px-4'>
                                {moves.map((move, index) => (
                                    <div
                                        key={move.id}
                                        className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors ${
                                            move.player === 1
                                                ? "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                                                : "bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                                        } ${index % 2 !== 0 ? "mt-1" : ""}`}
                                    >
                                        <span className='text-sm font-medium w-1/4'>
                                            {Math.ceil(move.id / 2)}.
                                            <span className='ml-1 text-xs'>
                                                {move.player === 1
                                                    ? "P1"
                                                    : "P2"}
                                            </span>
                                        </span>
                                        <span className='font-mono text-sm w-3/4 text-right'>
                                            {move.notation}
                                        </span>
                                    </div>
                                ))}
                                {moves.length === 0 && (
                                    <p className='text-center text-sm text-gray-500 dark:text-gray-400 py-4'>
                                        No moves played yet.
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Chat Card */}
                <Card className='flex-1 min-h-0 flex flex-col pt-6 pb-0'>
                    <CardHeader>
                        <CardTitle className='flex items-center text-base'>
                            <MessageSquare size={16} className='mr-2' />
                            Game Chat
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='flex-1 p-0 min-h-[150px]'>
                        <ScrollArea className='h-full p-4' ref={chatRef}>
                            <div className='flex flex-col space-y-3'>
                                {chatMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${
                                            msg.player === "CurrentPlayer"
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >
                                        <div
                                            className={`max-w-[80%] px-3 py-2 rounded-xl text-sm shadow-md ${
                                                msg.player === "CurrentPlayer"
                                                    ? "bg-blue-600 text-white rounded-br-none"
                                                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-tl-none"
                                            }`}
                                        >
                                            <strong className='block text-xs mb-0.5 opacity-80'>
                                                {msg.player === "CurrentPlayer"
                                                    ? "You"
                                                    : msg.player}
                                            </strong>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className='!p-4 border-t border-gray-100 dark:border-gray-700'>
                        <div className='flex w-full space-x-2'>
                            <Input
                                placeholder='Type a message...'
                                value={messageInput}
                                onChange={(e) =>
                                    setMessageInput(e.target.value)
                                }
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
            </div>
        </div>
    );
};

export default App;
