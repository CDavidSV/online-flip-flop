"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useWebSocket } from "./wsContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    GameMode,
    GameType,
    CreateGameRequest,
    CreateGameResponse,
    JoinGameRequest,
    JoinGameResponse,
} from "@/types/types";

interface GameRoomContext {
    roomId: string | null;
    username: string | null;
    inRoom: boolean;
    isSpectator: boolean;
    gameType: GameType | null;
    gameMode: GameMode | null;
    createGameRoom: (
        username: string,
        gameType: GameType,
        gameMode: GameMode
    ) => Promise<string>;
    joinRoom: (roomId: string, username: string) => Promise<JoinGameResponse>;
}

const gameRoomContext = createContext<GameRoomContext>({
    roomId: null,
    username: null,
    inRoom: false,
    isSpectator: false,
    gameType: null,
    gameMode: null,
    createGameRoom: async () => {
        return "";
    },
    joinRoom: async () => {
        return {
            is_spectator: false,
            game_type: GameType.FLIPFLOP_3x3,
            game_mode: GameMode.MULTIPLAYER,
        };
    },
});

export const useGameRoom = () => {
    return useContext(gameRoomContext);
};

export function GameRoomProvider({ children }: { children: ReactNode }) {
    const { isConnected, sendRequest } = useWebSocket();
    const router = useRouter();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isSpectator, setIsSpectator] = useState(false);
    const [inRoom, setInRoom] = useState(false);
    const [gameType, setGameType] = useState<GameType | null>(null);
    const [gameMode, setGameMode] = useState<GameMode | null>(null);

    useEffect(() => {
        if (isConnected) {
            if (roomId && username && !inRoom) {
                // Re-join the room if connection is re-established
                joinRoom(roomId, username).catch((error) => {
                    console.error("Failed to re-join room:", error);
                    toast.error("Failed to re-join the game room.");
                    router.push("/");

                    resetState();
                });
            }
        } else {
            setInRoom(false);
            setIsSpectator(false);
        }
    }, [isConnected, roomId, username]);

    // Resets the room state
    const resetState = () => {
        setRoomId(null);
        setUsername(null);
        setInRoom(false);
        setIsSpectator(false);
        setGameType(null);
        setGameMode(null);
    }

    /**
     * Creates a new game room.
     * @param username
     * @param gameType
     * @param gameMode
     * @returns
     */
    const createGameRoom = async (
        username: string,
        gameType: GameType,
        gameMode: GameMode
    ): Promise<string> => {
        if (!isConnected) {
            throw new Error("WebSocket is not connected");
        }

        const createGameRequest: CreateGameRequest = {
            username,
            game_type: gameType,
            game_mode: gameMode,
        };

        try {
            const response = await sendRequest("create", createGameRequest);

            if (response.type !== "created") {
                throw new Error("Unexpected response type");
            }

            const payload = response.payload as CreateGameResponse;

            setRoomId(payload.room_id);
            setInRoom(true);
            setUsername(username);
            setGameType(gameType);
            setGameMode(gameMode);

            return payload.room_id;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const joinRoom = async (
        roomId: string,
        username: string
    ): Promise<JoinGameResponse> => {
        if (!isConnected) {
            throw new Error("WebSocket is not connected");
        }

        const joinGameRequest: JoinGameRequest = {
            username,
            room_id: roomId,
        };

        try {
            const response = await sendRequest("join", joinGameRequest);
            if (response.type !== "joined") {
                throw new Error("Unexpected response type");
            }

            const payload = response.payload as JoinGameResponse;

            setRoomId(roomId);
            setInRoom(true);
            setUsername(username);
            setIsSpectator(payload.is_spectator);
            setGameType(payload.game_type);
            setGameMode(payload.game_mode);

            return payload;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    return (
        <gameRoomContext.Provider
            value={{
                roomId,
                username,
                inRoom,
                isSpectator,
                gameType,
                gameMode,
                createGameRoom,
                joinRoom,
            }}
        >
            {children}
        </gameRoomContext.Provider>
    );
}
