import { useCallback, useEffect, useState } from "react";

interface ScreenChangeRequest {
	apply: () => void;
	/** Called instead of `apply` when the request cannot be honoured. */
	onDrop: () => void;
}

/**
 * Lets async flows (a PICT run, a directory listing) request a screen change
 * - a tab switch, an overlay open - without racing the state they must not
 * override. Requests are queued in state and decided in an effect, once both
 * they and any competing update have rendered: if `canApply` still holds,
 * the first pending request is applied.
 *
 * Every other pending request is dropped and told so via `onDrop`, so the
 * user gets a status line instead of silence: either nothing may change (an
 * overlay is on top, a text field is being edited), or the first request has
 * just put an overlay on top - the very case a request is dropped for, since
 * it would open invisibly beneath it. Nothing is replayed later; the
 * callers' shortcuts (`[s]`, `[o]`, `[3]`) remain available on demand.
 */
export function useDeferredScreenChange(
	canApply: boolean,
): (apply: () => void, onDrop: () => void) => void {
	const [pending, setPending] = useState<ReadonlyArray<ScreenChangeRequest>>(
		[],
	);

	const requestScreenChange = useCallback(
		(apply: () => void, onDrop: () => void) => {
			setPending((queue) => [...queue, { apply, onDrop }]);
		},
		[],
	);

	useEffect(() => {
		const [first, ...rest] = pending;
		if (!first) return;
		// Removed before running: a callback that throws must not leave its
		// request queued to run again. Only the handled entries go, so a request
		// enqueued between this commit and the effect survives for the next run.
		setPending((queue) => queue.slice(pending.length));
		try {
			if (canApply) first.apply();
			else first.onDrop();
		} finally {
			for (const request of rest) request.onDrop();
		}
	}, [pending, canApply]);

	return requestScreenChange;
}
