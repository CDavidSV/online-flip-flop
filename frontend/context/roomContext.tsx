"use client";

import { useWebSocket } from "./wsContext";
import {
    GameMode,
    GameType,
    CreateGameRequest,
    CreateGameResponse,
    JoinGameRequest,
    JoinGameResponse,
    GameStatus,
    Player,
    PlayerColor,
} from "@/types/types";
import {
    createContext,
    Dispatch,
    ReactNode,
    SetStateAction,
    useContext,
    useEffect,
    useState,
} from "react";

interface GameRoomContext {
    roomId: string | null;
    username: string | null;
    inRoom: boolean;
    isSpectator: boolean;
    gameStatus: GameStatus;
    gameType: GameType | null;
    gameMode: GameMode | null;
    currentPlayer: Player | null;
    opponentPlayer: Player | null;
    currentTurn: PlayerColor | null;
    createGameRoom: (
        username: string,
        gameType: GameType,
        gameMode: GameMode,
    ) => Promise<string>;
    joinRoom: (roomId: string, username?: string) => Promise<JoinGameResponse>;
    leaveRoom: () => Promise<boolean>;
    setCurrentTurn: Dispatch<SetStateAction<PlayerColor | null>>
}

const gameRoomContext = createContext<GameRoomContext>({
    roomId: null,
    username: null,
    inRoom: false,
    isSpectator: false,
    gameStatus: "waiting_for_players",
    gameType: null,
    gameMode: null,
    currentPlayer: null,
    opponentPlayer: null,
    currentTurn: null,
    createGameRoom: async () => {
        return "";
    },
    joinRoom: async () => {
        return {
            is_spectator: false,
            game_type: GameType.FLIPFLOP_3x3,
            game_mode: GameMode.MULTIPLAYER,
            game_state: {
                players: [],
                board: "",
                current_turn: PlayerColor.WHITE,
                status: "waiting_for_players",
                winner: null,
            },
        };
    },
    leaveRoom: () => {
        return Promise.resolve(false);
    },
    setCurrentTurn: () => {},
});

export const useGameRoom = () => {
    return useContext(gameRoomContext);
};

export function GameRoomProvider({ children }: { children: ReactNode }) {
    const { isConnected, sendRequest, on, clientId } = useWebSocket();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isSpectator, setIsSpectator] = useState(false);
    const [inRoom, setInRoom] = useState(false);
    const [gameType, setGameType] = useState<GameType | null>(null);
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>(
        "waiting_for_players",
    );
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [opponentPlayer, setOpponentPlayer] = useState<Player | null>(null);
    const [currentTurn, setCurrentTurn] = useState<PlayerColor | null>(null);

    useEffect(() => {
        if (isConnected) return;
        resetState();
    }, [isConnected, clientId]);

    useEffect(() => {
        const cleanupPlayerLeft = on("player_left", () => {
            setGameStatus("waiting_for_players");
        });

        const cleanupStart = on("start", (payload: any) => {
            if (!payload && !payload.players) {
                return;
            }

            // Find current player and opponent from the payload
            const current = payload.players.find((p: any) => p.id === clientId);
            const opponent = payload.players.find(
                (p: any) => p.id !== clientId,
            );

            if (current) {
                setCurrentPlayer({
                    id: current.id,
                    username: current.username,
                    color: current.color,
                    is_ai: current.is_ai,
                });
            }

            if (opponent) {
                setOpponentPlayer({
                    id: opponent.id,
                    username: opponent.username,
                    color: opponent.color,
                    is_ai: opponent.is_ai,
                });
            }

            if (current && opponent) {
                setGameStatus("ongoing");
                setCurrentTurn(payload.current_turn);
            }
        });

        const cleanupEnd = on("end", () => {
            setGameStatus("closed");
        });

        const cleanupRejoin = on("player_rejoined", () => {
            setGameStatus("ongoing");
        });

        // Cleanup event listeners
        return () => {
            cleanupPlayerLeft();
            cleanupStart();
            cleanupEnd();
            cleanupRejoin();
        };
    }, [on]);

    // Resets the room state
    const resetState = () => {
        setRoomId(null);
        setUsername(null);
        setInRoom(false);
        setIsSpectator(false);
        setGameType(null);
        setGameMode(null);
        setGameStatus("waiting_for_players");
        setCurrentPlayer(null);
        setOpponentPlayer(null);
    };

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
        gameMode: GameMode,
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
            setCurrentPlayer({
                id: response.payload.clientId,
                username,
                color: null,
                is_ai: false,
            });

            return payload.room_id;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    /**
     * Joins a game room with optional username.
     * If username is not provided, attempts to rejoin as an existing player.
     * @param roomId - The room ID to join
     * @param username - Optional username for new players/spectators
     * @returns JoinGameResponse
     */
    const joinRoom = async (
        roomId: string,
        username?: string,
    ): Promise<JoinGameResponse> => {
        if (!isConnected) {
            throw new Error("WebSocket is not connected");
        }

        const joinGameRequest: JoinGameRequest = {
            room_id: roomId,
        };

        // Only include username if provided
        if (username) {
            joinGameRequest.username = username;
        }

        try {
            const response = await sendRequest("join", joinGameRequest);
            if (response.type !== "joined") {
                throw new Error("Unexpected response type");
            }

            const payload = response.payload as JoinGameResponse;
            const players = payload.game_state.players;

            setRoomId(roomId);
            setInRoom(true);
            setIsSpectator(payload.is_spectator);
            setGameType(payload.game_type);
            setGameMode(payload.game_mode);
            setGameStatus(payload.game_state.status);
            setCurrentTurn(payload.game_state.current_turn);

            if (payload.is_spectator) {
                // Set username if provided
                if (username) {
                    setUsername(username);
                }
                setCurrentPlayer(
                    players.find((p) => p.color === PlayerColor.WHITE) || null,
                );
                setOpponentPlayer(
                    players.find((p) => p.color === PlayerColor.BLACK) || null,
                );
            } else {
                // Player is either new or rejoining
                const playerData = players.find((p) => p.id === clientId);
                if (playerData) {
                    // Use provided username for new player, or stored username for rejoining
                    setUsername(username || playerData.username);
                    setCurrentPlayer(playerData);
                    setOpponentPlayer(
                        players.find((p) => p.id !== clientId) || null,
                    );
                }
            }

            return payload;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const leaveRoom = async (): Promise<boolean> => {
        if (!isConnected || !inRoom) return false;

        try {
            const response = await sendRequest("leave", null);
            if (response.type === "left") {
                resetState();
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to leave room:", error);
            return false;
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
                gameStatus,
                currentPlayer,
                opponentPlayer,
                currentTurn,
                createGameRoom,
                joinRoom,
                leaveRoom,
                setCurrentTurn,
            }}
        >
            {children}
        </gameRoomContext.Provider>
    );
}
