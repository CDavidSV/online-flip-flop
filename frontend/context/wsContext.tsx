"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type WebsocketContextType = {
    connect: (game_id: string, username: string, password?: string) => void;
    disconnect: () => void;
    onDisconnect?: () => void;
    isConnected: boolean;
    clientId: string | null;
};

const websocketContext = createContext<WebsocketContextType>({
    connect: () => {},
    disconnect: () => {},
    onDisconnect: () => {},
    isConnected: false,
    clientId: null,
});

const PING_INTERVAL = 60000; // Every minute

export const useWebSocket = () => useContext(websocketContext);

export const WebsocketProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const socket = useRef<WebSocket | null>(null);
    const handleOnDisconnect = useRef<(() => void) | null>(null);

    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [clientId, setClientId] = useState<string | null>(null);

    const wsURL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

    const ping = () => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN) return;

        socket.current.send("ping");

        // Schedule the next ping
        setTimeout(ping, PING_INTERVAL);
    }

    const joinGame = (game_id: string, username: string, password?: string) => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN) return;

        const joinMessage = {
            action: "join",
            request_id: crypto.randomUUID(),
            payload: {
                room_id: game_id,
                username: username,
                password: password || null,
            },
        };

        socket.current.send(JSON.stringify(joinMessage));
    };

    const connect = (game_id: string, username: string, password?: string) => {
        if (socket.current) {
            // If already connected, just try to join the game
            joinGame(game_id, username, password);
            return;
        }

        const ws = new WebSocket(wsURL + "/game/ws");

        ws.onopen = () => {
            console.log("WebSocket connection established");

            joinGame(game_id, username, password);

            // Start the ping loop
            ping();

            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            // TODO: Handle messages
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed");
            setIsConnected(false);
            setClientId(null);
            socket.current = null;

            if (handleOnDisconnect.current) {
                handleOnDisconnect.current();
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            disconnect();
        };

        socket.current = ws;
    };

    const disconnect = () => {
        if (socket.current) {
            socket.current.close();
        }
    }

    return (
        <websocketContext.Provider value={{ isConnected, clientId, connect, disconnect }}>
            {children}
        </websocketContext.Provider>
    );
};
