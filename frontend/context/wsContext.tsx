"use client";

import { WSError, WSEventType, WSMessage } from "@/types/types";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type WebsocketContextType = {
    isConnected: boolean;
    clientId: string | null;
    sendMessage: (type: string, payload: any) => void;
    sendRequest: (type: string, payload: any) => Promise<WSMessage>;
    on: <T>(eventType: WSEventType, handler: (payload: T) => void) => () => void;
    off: (eventType: WSEventType, handler: (payload: any) => void) => void;
};

const websocketContext = createContext<WebsocketContextType>({
    isConnected: false,
    clientId: null,
    sendMessage: () => { },
    sendRequest: () => Promise.reject(new Error("WebSocket not initialized")),
    on: () => () => {},
    off: () => {}
});

const PING_INTERVAL = 40000; // Every 40 seconds
const RECCONNECT_INTERVAL = 5000; // Every 5 seconds
const CLIENT_ID_KEY = "ws_client_id";
const wsURL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export const useWebSocket = () => useContext(websocketContext);

export const WebsocketProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const socket = useRef<WebSocket | null>(null);
    const requests = useRef<Map<string, { resolve: (value: any) => void, reject: (error: WSError) => void }>>(new Map());
    const eventHandlers = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [clientId, setClientId] = useState<string | null>(null);

    // Establishes WebSocket connection on mount
    useEffect(() => {
        // Gets the stored client id from localStorage
        const storedClientId = localStorage.getItem(CLIENT_ID_KEY);
        if (storedClientId) {
            setClientId(storedClientId);
        }

        // If there is a stored client id, it will be sent to the server upon connection to resume the session
        connect();
    }, []);

    /**
     * Pings the server to keep the connection alive.
     */
    const ping = () => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN) return;

        socket.current.send("ping");

        // Schedule the next ping
        setTimeout(ping, PING_INTERVAL);
    }

    /**
     * Stores the client id in state and localStorage
     */
    const saveClientId = (id: string) => {
        if (clientId && clientId === id) return;

        setClientId(id);
        localStorage.setItem(CLIENT_ID_KEY, id);
    }

    /**
     * Called when the websocket connection is established.
     */
    const handleOnOpen = () => {
        console.log("WebSocket connection established");

        // Start the ping loop
        ping();

        setIsConnected(true);
    }

    /**
     * Called when a message is received from the server.
     */
    const handleOnMessage = (event: MessageEvent) => {
        if (event.data === "pong") {
            return;
        }

        var message: WSMessage;
        try {
            message = JSON.parse(event.data);
        } catch (err) {
            console.error("Failed to parse WebSocket message:", event.data);
            return;
        }

        // First message sent contains the clientID
        if (message.type === "connected") {
            saveClientId(message.payload.client_id);
            return;
        }

        // Handle events first
        const handlers = eventHandlers.current.get(message.type);
        if (handlers) {
            handlers.forEach(handler => handler(message.payload));
            return;
        }

        // Then handle responses
        if (!message.request_id || !requests.current.has(message.request_id)) return;
        const { resolve, reject } = requests.current.get(message.request_id)!;

        requests.current.delete(message.request_id);

        if (message.type === "error") {
            reject(message.payload as WSError);
            return;
        } else {
            resolve(message as WSMessage);
            return;
        }
    }

    /**
     * Called when the websocket connection is closed.
     */
    const handleOnClose = () => {
        setIsConnected(false);
        setClientId(null);
        socket.current = null;

        // Attempt to reconnect after a delay
        setTimeout(() => {
            console.log("Attemting to reconnect...");
            connect();
        }, RECCONNECT_INTERVAL);
    }

    /**
     * Called when there is an error with the websocket connection.
     */
    const handleOnError = (error: Event) => {
        console.error("WebSocket error:", error);
    }

    /**
     * Establishes the WebSocket connection.
     */
    const connect = () => {
        if (socket.current) {
            console.warn("WebSocket connection already established");
            return;
        }

        const ws_client_id = localStorage.getItem(CLIENT_ID_KEY);

        let url = `${wsURL}/ws`;
        if (ws_client_id) {
            url += `?client_id=${ws_client_id}`;
        }
        const ws = new WebSocket(url);

        ws.onopen = handleOnOpen;
        ws.onmessage = handleOnMessage;
        ws.onclose = handleOnClose;
        ws.onerror = handleOnError;

        socket.current = ws;
    };

    /**
     * Sends a message to the server.
     */
    const sendMessage = (type: string, payload: any): string => {
        if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
            return "";
        }

        const requestId = crypto.randomUUID();
        const message: WSMessage = {
            type,
            payload,
            request_id: requestId,
        };

        socket.current.send(JSON.stringify(message));
        return requestId;
    }

    /**
     * Sends a request to the server and returns a promise that resolves with the response.
     */
    const sendRequest = (type: string, payload: any): Promise<WSMessage> => {
        return new Promise<WSMessage>((resolve, reject) => {
            const requestId = sendMessage(type, payload);

            requests.current.set(requestId, { resolve, reject });
        });
    }

    /**
     * Registers an event handler for a specific event type.
     * @param eventType
     * @param handler
     * @returns Cleanup function to unregister the handler
     */
    const on = <T,>(eventType: WSEventType, handler: (payload: T) => void): (() => void) => {
        if (eventHandlers.current.has(eventType)) {
            eventHandlers.current.get(eventType)!.add(handler);
        } else {
            eventHandlers.current.set(eventType, new Set([handler]));
        }

        return () => off(eventType, handler);
    }

    /**
     * Unregisters an event handler for a specific event type.
     * @param eventType
     * @param handler
     */
    const off = (eventType: WSEventType, handler: (payload: any) => void): void => {
        if (!eventHandlers.current.has(eventType)) return;

        const handlers = eventHandlers.current.get(eventType)!;
        handlers.delete(handler);
    }

    return (
        <websocketContext.Provider value={{ isConnected, clientId, sendMessage, sendRequest, on, off }}>
            {children}
        </websocketContext.Provider>
    );
};
