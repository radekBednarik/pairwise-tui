import { useRef, useSyncExternalStore } from "react";
import {
	DEFAULT_UPDATE_DEPS,
	UpdateController,
	type UpdateDeps,
	type UpdateHost,
	type UpdateSnapshot,
} from "../update/controller";

export interface UpdateState {
	snapshot: UpdateSnapshot;
	controller: UpdateController;
}

/**
 * Connects the update flow to React. The flow itself lives in
 * `UpdateController` (no React in it); this hook creates one controller for
 * the lifetime of the app and re-renders when its snapshot changes.
 *
 * `host` may be a new object on every render: the controller always calls
 * the latest one, so its callbacks can close over current state.
 */
export function useUpdateState(
	host: UpdateHost,
	deps?: Partial<UpdateDeps>,
): UpdateState {
	const hostRef = useRef(host);
	hostRef.current = host;

	const controllerRef = useRef<UpdateController | null>(null);
	if (controllerRef.current === null) {
		controllerRef.current = new UpdateController(
			{ ...DEFAULT_UPDATE_DEPS, ...deps },
			{
				showStatus: (message, isError) =>
					hostRef.current.showStatus(message, isError),
				log: (message, isError) => hostRef.current.log(message, isError),
				hasUnsavedWork: () => hostRef.current.hasUnsavedWork(),
				saveModel: () => hostRef.current.saveModel(),
				restart: (version) => hostRef.current.restart(version),
			},
		);
	}
	const controller = controllerRef.current;
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
	);
	return { snapshot, controller };
}
