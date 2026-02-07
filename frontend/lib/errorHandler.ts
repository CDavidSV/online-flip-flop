import { ErrorCode, WSError } from "@/types/types";

export interface ErrorInfo {
    code: ErrorCode | string;
    message: string;
    details?: any;
}

/**
 * Type guard to ensure the payload is a valid WSError
 */
export const isWSError = (payload: any): payload is WSError => {
    return (
        payload !== null &&
        typeof payload === "object" &&
        typeof payload.code === "string"
    );
};

/**
 * Gets error information from the WebSocket error
 * @param error
 * @returns
 */
export function getErrorInfo(error: WSError): ErrorInfo {
    const errorCode = error.code as ErrorCode;

    const messages: Record<ErrorCode, string> = {
        [ErrorCode.VALIDATION_FAILED]:
            "Validation failed. Please check your input and try again.",
        [ErrorCode.ALREADY_IN_GAME]:
            "You are already in a game. Please leave your current game first.",
        [ErrorCode.INVALID_MESSAGE_FORMAT]:
            "An error occurred while processing your request. Please try again.",
        [ErrorCode.ROOM_NOT_FOUND]:
            "Game room not found. It may have been closed or the code is incorrect.",
        [ErrorCode.ROOM_CLOSED]: "This game room has been closed.",
        [ErrorCode.CLIENT_NOT_FOUND]: "Session not found. Please reconnect.",
        [ErrorCode.INVALID_MSG_TYPE]:
            "Invalid message type. Please refresh the page.",
        [ErrorCode.NOT_IN_GAME]: "You must join a game first.",
        [ErrorCode.GAME_NOT_STARTED]:
            "The game has not started yet. Please wait for another player.",
        [ErrorCode.NOT_YOUR_TURN]: "It's not your turn yet.",
        [ErrorCode.ILLEGAL_MOVE]:
            "That move is not allowed. Please try a different move.",
        [ErrorCode.GAME_ENDED]: "This game has already ended.",
        [ErrorCode.PLAYER_NOT_ACTIVE]:
            "You are not an active player in this game.",
        [ErrorCode.ID_GENERATION_FAILED]:
            "Failed to create game room. Please try again.",
        [ErrorCode.USERNAME_REQUIRED]: "Username is required to join a game.",
        [ErrorCode.UNAUTHORIZED_ACTION]:
            "You are not authorized to perform this action.",
        [ErrorCode.INVALID_GAME_MODE]: "Invalid game mode selected.",
        [ErrorCode.INVALID_AI_DIFFICULTY]: "Invalid AI difficulty selected.",
        [ErrorCode.ROOM_FULL]: "This game room is full.",
    };

    return {
        code: errorCode,
        message:
            messages[errorCode] ||
            "An unexpected error occurred. Please try again.",
        details: error.details,
    };
}

/**
 * Checks if an error is a specific error code
 * @param error The WebSocket error object
 * @param code The error code to check against
 * @returns True if the error matches the specified code
 */
export function isErrorCode(error: WSError, code: ErrorCode): boolean {
    return error.code === code;
}

/**
 * Checks if multiple errors match any of the provided error codes
 * @param error The WebSocket error object
 * @param codes Array of error codes to check against
 * @returns True if the error matches any of the specified codes
 */
export function isAnyErrorCode(error: WSError, codes: ErrorCode[]): boolean {
    return codes.includes(error.code as ErrorCode);
}

/**
 * Gets the error message from a WSError
 * @param error - The WebSocket error object
 * @returns string
 */
export function getErrorMessage(error: WSError): string {
    return getErrorInfo(error).message;
}
