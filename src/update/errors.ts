export type UpdateErrorKind =
	/** The download does not match the published checksum. */
	| "checksum-mismatch"
	/** The release publishes no checksum for this artifact. */
	| "checksum-missing"
	/** The user cancelled, or the app is quitting. */
	| "cancelled"
	/** The release source could not be reached or answered badly. */
	| "network"
	/** More bytes arrived than the release announced. */
	| "too-large"
	/** A file could not be written, renamed or backed up. */
	| "storage"
	/** The staged file is missing or changed after verification. */
	| "verify-failed"
	/** The app file was moved or replaced since startup. */
	| "moved"
	/** The previous backup is still in use by a running copy. */
	| "locked"
	/** Another copy of the app is updating right now. */
	| "busy";

/** A failure of an update step, with a kind the interface maps to a message. */
export class UpdateError extends Error {
	readonly kind: UpdateErrorKind;

	constructor(kind: UpdateErrorKind, message: string) {
		super(message);
		this.name = "UpdateError";
		this.kind = kind;
	}
}

export function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
