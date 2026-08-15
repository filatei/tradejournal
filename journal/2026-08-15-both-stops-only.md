# BOTH + stops-only: breakout-directional, not direction-locked

**Date:** 2026-08-15  
**Status:** hypothesis to validate

## Configuration

- `StartDirection = BOTH`
- `PendingKind = PEND_STOPS_ONLY`
- `EnableRealLadder = true`

## Observation

`BOTH` enables the buy and sell sides. With stops-only, the buy ladder is
above the reference price and the sell ladder is below it. A sustained upward
move should fill buy stops while leaving sell stops dormant; a sustained
downward move is mirrored.

## Important qualification

This is not a “never take the other direction” setting. If price reverses and
breaks the other-side stop ladder, that side can fill. The practical risk
question is how much net and gross exposure exists at that reversal, subject
to `MaxPositions`, `MaxPendingOrders`, lot scaling, individual TP/SL and the
basket exit.

## Next test

Run the saved preset over each available broker M1 export, then compare:

1. fills by direction,
2. reversals after a first directional fill,
3. maximum concurrent positions,
4. effect of lower `LadderDepthPerKind` and a hard `MaxExposureLots`.
