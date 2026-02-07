package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/CDavidSV/online-flip-flop/games"
	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
)

type AIDifficulty string

var validDifficulties = []AIDifficulty{"easy", "medium", "hard"}

type AI interface {
	GetBestMove(ctx context.Context, aiPlayer games.PlayerSide) (json.RawMessage, error)
	SetGame(game games.Game)
	Name() string
}

// Returns the AI instance for the given game type and difficulty.
func NewAI(game games.Game, gameType games.GameType, difficulty AIDifficulty) (AI, error) {
	if !slices.Contains(validDifficulties, difficulty) {
		return nil, apperrors.ErrInvalidAIDifficulty
	}

	switch gameType {
	case games.TYPE_FLIPFLOP3x3, games.TYPE_FLIPFLOP5x5:
		flipFLopGame, ok := game.(*games.FlipFlop)
		if !ok {
			return nil, fmt.Errorf("game is not a FlipFlop instance")
		}

		return NewFlipFlopAI(flipFLopGame, difficulty), nil
	default:
		return nil, fmt.Errorf("no AI implementation for game type '%s'", gameType)
	}
}
