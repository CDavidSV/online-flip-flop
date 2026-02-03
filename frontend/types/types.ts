enum GameType {
    FLIPFLOP_3x3 = "flipflop3x3",
    FLIPFLOP_5x5 = "flipflop5x5",
    FLIPFOUR = "flipfour",
}

enum GameMode {
    SINGLEPLAYER = "singleplayer",
    MULTIPLAYER = "multiplayer",
}

enum PlayerColor {
    WHITE = 0,
    BLACK = 1,
}

enum PieceType {
    ROOK = 0,
    BISHOP = 1,
}

enum ErrorCode {
    VALIDATION_FAILED = "validation_failed",
    INVALID_REQUEST_PAYLOAD = "invalid_request_payload",
    ALREADY_IN_GAME = "already_in_game",
    USERNAME_REQUIRED = "username_required",
    INVALID_MESSAGE_FORMAT = "invalid_message_format",
    INVALID_MESSAGE_PAYLOAD = "invalid_message_payload",
    ROOM_NOT_FOUND = "room_not_found",
    ROOM_CLOSED = "room_closed",
    CLIENT_NOT_FOUND = "client_not_found",
    INVALID_MSG_TYPE = "invalid_msg_type",
    NOT_IN_GAME = "must_join_game_first",
    GAME_NOT_STARTED = "game_not_started",
    NOT_YOUR_TURN = "not_your_turn",
    ILLEGAL_MOVE = "illegal_move",
    GAME_ENDED = "game_ended",
    PLAYER_NOT_ACTIVE = "player_not_active",
    ID_GENERATION_FAILED = "id_generation_failed",
}

// Incoming WebSocket message events
type WSEventType =
    | "player_left"
    | "start"
    | "move"
    | "chat"
    | "end"
    | "player_rejoined"
    | "joined";

// Game state types
type GameStatus = "waiting_for_players" | "ongoing" | "closed";

interface CreateGameRequest {
    username: string;
    game_type: GameType;
    game_mode: GameMode;
}

interface WSMessage {
    type: string;
    payload: any;
    request_id?: string;
}

interface WSError {
    code: ErrorCode | string;
    details?: any;
}

interface CreateGameRequest {
    username: string;
    game_type: GameType;
    game_mode: GameMode;
}

interface CreateGameResponse {
    room_id: string;
    is_spectator: boolean;
}

interface JoinGameRequest {
    room_id: string;
    username?: string;
}

interface GameState {
    board: string;
    current_turn: PlayerColor;
    status: GameStatus;
    winner: PlayerColor | null;
    players: Player[];
}

interface JoinGameResponse {
    is_spectator: boolean;
    game_type: GameType;
    game_mode: GameMode;
    game_state: GameState;
    move_history: MoveSnapshot[];
    messages: ChatMessage[];
}

interface MessageSendRequest {
    content: string;
}

interface MessageEvent {
    clientId: string;
    username: string;
    message: string;
}

interface Player {
    id: string;
    username: string;
    color: PlayerColor | null;
    is_ai: boolean;
}

interface FlipFlopPiece {
    id: string;
    color: PlayerColor;
    side: PieceType;
    pos: [number, number];
    captured: boolean;
    selected: boolean;
}

interface PlayerRejoinMsg {
    player_id: string;
}

interface GameEndMsg {
    reason: string;
    winner: PlayerColor | null;
}

interface GameMoveMsg {
    board: string;
    color: PlayerColor;
    move: {
        from: string;
        to: string;
    };
    player_id: string;
}

interface MoveSnapshot {
    player_id: string;
    from: string;
    to: string;
}

interface ChatMessage {
    client_id: string;
    username: string;
    message: string;
}

export { GameType, GameMode, PlayerColor, PieceType, ErrorCode };
export type {
    CreateGameResponse,
    CreateGameRequest,
    JoinGameRequest,
    JoinGameResponse,
    MessageEvent,
    MessageSendRequest,
    WSMessage,
    WSError,
    WSEventType,
    Player,
    FlipFlopPiece,
    GameStatus,
    PlayerRejoinMsg,
    GameEndMsg,
    GameMoveMsg,
    MoveSnapshot,
    ChatMessage,
};
