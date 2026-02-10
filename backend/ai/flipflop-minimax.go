package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

const MAX_SCORE = 1_000_000

type FlipFlopAI struct {
	game           *games.FlipFlop
	difficulty     AIDifficulty
	aiPlayer       *games.FFPlayer
	opponentPlayer *games.FFPlayer
	ctx            context.Context
}

// Counts how many pieces the player has that are not captured
func countNonCapturedPieces(player *games.FFPlayer) int {
	count := 0
	for _, piece := range player.Pieces {
		if !piece.Captured {
			count++
		}
	}

	return count
}

func countWinningMoves(moves []games.ValidMove, opponentPlayer *games.FFPlayer) int {
	count := 0
	for _, move := range moves {
		// If the final destination equals the opponent's goal, then it's a winning move
		if move.To == opponentPlayer.Goal {
			count++
		}
	}
	return count
}

// Seriealizes move to JSON format to be sent to the engine
func serializeMove(startPos, endPos games.FFBoardPos, boardSize int) json.RawMessage {
	move := games.BaseMove{
		From: startPos.String(boardSize),
		To:   endPos.String(boardSize),
	}

	data, _ := json.Marshal(move)
	return data
}

// Checks if the context has been cancelled
func (ai *FlipFlopAI) cancelled() bool {
	select {
	case <-ai.ctx.Done():
		return true
	default:
		return false
	}
}

// Returns true if the player is in check
func (ai *FlipFlopAI) inCheck(player *games.FFPlayer) bool {
	goalPos := player.Goal

	pieceInGoal := ai.game.Board[goalPos.Row][goalPos.Col]
	if pieceInGoal != nil && pieceInGoal.Color != player.Color {
		return true
	}

	return false
}

// Filters out all moves that would leave the player in check
func (ai *FlipFlopAI) filterSafeMoves(moves []games.ValidMove, player *games.FFPlayer) []games.ValidMove {
	safeMoves := make([]games.ValidMove, 0, len(moves))

	for _, move := range moves {
		// Try the move
		if err := ai.game.ApplyMove(serializeMove(move.From, move.To, int(ai.game.Type))); err != nil {
			continue // Skip invalid moves
		}

		// Check if move leaves player in check
		leavesInCheck := ai.inCheck(player)
		ai.game.UndoLastMove()

		if !leavesInCheck {
			safeMoves = append(safeMoves, move)
		}
	}

	return safeMoves
}

// Evaluates the current board state and returns a score for the AI
func (ai *FlipFlopAI) evaluate() int {
	if ai.game.IsGameEnded() {
		winner := ai.game.GetWinner()
		if winner == ai.aiPlayer.Color {
			return MAX_SCORE
		} else if winner == ai.opponentPlayer.Color {
			return -MAX_SCORE
		} else {
			return 0 // Draw
		}
	}

	// Increase points if the opponent player is in check
	if ai.inCheck(ai.opponentPlayer) {
		return MAX_SCORE / 2
	}

	// If the opponent has no valid moves, then this is good for the AI
	validOpponentMoves, _ := ai.game.GetValidMoves(ai.opponentPlayer)
	if len(validOpponentMoves) == 0 {
		return MAX_SCORE / 2
	}

	score := 0

	// Increase or decrease score based on the number of valid moves
	validAIMoves, _ := ai.game.GetValidMoves(ai.aiPlayer)
	score += len(validAIMoves) * 100
	score -= len(validOpponentMoves) * 100

	// Increase or decrease score based on the number of winning moves each player has
	score += countWinningMoves(validAIMoves, ai.opponentPlayer) * 1000
	score -= countWinningMoves(validOpponentMoves, ai.aiPlayer) * 1000

	// Increase or decrease score based on the number of captured pieces
	score += countNonCapturedPieces(ai.aiPlayer) * 500
	score -= countNonCapturedPieces(ai.opponentPlayer) * 500

	return score
}

func (ai *FlipFlopAI) flipFlopMinimax(depth int) int {
	if ai.cancelled() {
		// If it was cancelled, return evaluate early
		return ai.evaluate()
	}

	if depth <= 0 || ai.game.IsGameEnded() {
		return ai.evaluate()
	}

	if ai.game.CurrentTurn() == ai.aiPlayer.Color {
		bestScore := -MAX_SCORE

		// Maximize score for the ai player
		moves, _ := ai.game.GetValidMoves(ai.aiPlayer)
		if ai.inCheck(ai.aiPlayer) {
			// If the ai player is in check, only consider safe moves
			moves = ai.filterSafeMoves(moves, ai.aiPlayer)
		}

		if len(moves) == 0 {
			return -MAX_SCORE // No moves
		}

		for _, move := range moves {
			if err := ai.game.ApplyMove(serializeMove(move.From, move.To, ai.game.BoardSize())); err != nil {
				// Skip move
				continue
			}

			score := ai.flipFlopMinimax(depth - 1)
			ai.game.UndoLastMove()

			if score > bestScore {
				bestScore = score
			}
		}

		return bestScore
	}

	// Minimize score for the opponent player
	bestScore := MAX_SCORE

	moves, _ := ai.game.GetValidMoves(ai.opponentPlayer)
	for _, move := range moves {
		if err := ai.game.ApplyMove(serializeMove(move.From, move.To, ai.game.BoardSize())); err != nil {
			continue
		}

		score := ai.flipFlopMinimax(depth - 1)
		ai.game.UndoLastMove()

		if score < bestScore {
			bestScore = score
		}
	}

	return bestScore
}

func (ai *FlipFlopAI) findBestFlipFlopMove(depth int) (json.RawMessage, error) {
	game := ai.game
	aiPlayer := ai.aiPlayer

	if aiPlayer.Color != game.CurrentTurn() {
		return nil, apperrors.ErrNotYourTurn
	}

	moves, _ := game.GetValidMoves(aiPlayer)
	if ai.inCheck(aiPlayer) {
		moves = ai.filterSafeMoves(moves, aiPlayer)
	}

	if len(moves) == 0 {
		return nil, nil
	}

	bestMove := serializeMove(moves[0].From, moves[0].To, game.BoardSize())
	bestScore := -MAX_SCORE

	for _, move := range moves {
		// Check if the move calculation has been cancelled
		if ai.cancelled() {
			// Returns the best move found so far
			return bestMove, nil
		}

		move := serializeMove(move.From, move.To, game.BoardSize())
		if err := game.ApplyMove(move); err != nil {
			return nil, err
		}

		score := ai.flipFlopMinimax(depth - 1)
		ai.game.UndoLastMove()

		if score > bestScore {
			bestScore = score
			bestMove = move
		}
	}

	return bestMove, nil
}

func (ai *FlipFlopAI) Name() string {
	// Random list of names
	names := []string{
		"Iota",
		"Alpha",
		"Beta",
		"Gamma",
		"Delta",
		"Zeta",
		"Eta",
		"Theta",
		"Epsilon",
		"Ichigo",
		"Miku",
		"Hiro",
		"Goro",
		"Hange",
		"Levi",
		"Erwin",
		"Armin",
		"Eren",
		"Historia",
		"Mikasa",
		"Eren",
		"Swindler",
		"Violet",
		"Esdeath",
		"Akame",
		"Sheele",
		"Chelsea",
		"Mine",
		"Leone",
	}

	return fmt.Sprintf("%s (AI)", names[rand.IntN(len(names))])
}

func (ai *FlipFlopAI) SetGame(game games.Game) {
	flipFlopGame, ok := game.(*games.FlipFlop)
	if !ok {
		panic("game is not a FlipFlop instance")
	}
	ai.game = flipFlopGame
}

func (ai *FlipFlopAI) GetBestMove(ctx context.Context, aiPlayer games.PlayerSide) (json.RawMessage, error) {
	ai.ctx = ctx
	if aiPlayer == games.COLOR_WHITE {
		ai.aiPlayer = ai.game.Player1
		ai.opponentPlayer = ai.game.Player2
	} else {
		ai.aiPlayer = ai.game.Player2
		ai.opponentPlayer = ai.game.Player1
	}

	depth := 4
	switch ai.difficulty {
	case "easy":
		depth = 2
	case "medium":
		depth = 4
	case "hard":
		depth = 6
	}

	return ai.findBestFlipFlopMove(depth)
}

func NewFlipFlopAI(game *games.FlipFlop, difficulty AIDifficulty) *FlipFlopAI {
	return &FlipFlopAI{
		game:       game,
		difficulty: difficulty,
	}
}
