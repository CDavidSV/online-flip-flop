"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface GameRoomContext {
    roomId: string;
    username: string;
    password: string;
    setRoomId: (roomId: string) => void;
    setUsername: (username: string) => void;
    setPassword: (password: string) => void;
}

const gameRoomContext = createContext<GameRoomContext>({
    roomId: "",
    username: "",
    password: "",
    setRoomId: (roomId: string) => {},
    setUsername: (username: string) => {},
    setPassword: (password: string) => {},
});

export const useGameRoom = () => {
    return useContext(gameRoomContext);
};

export function GameProvider({ children }: { children: ReactNode }) {
    const [roomId, setRoomId] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    return (
        <gameRoomContext.Provider
            value={{
                roomId,
                username,
                password,
                setRoomId,
                setUsername,
                setPassword,
            }}
        >
            {children}
        </gameRoomContext.Provider>
    );
}
