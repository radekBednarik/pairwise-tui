// Compile-time constants injected by scripts/build-common.ts. Both are absent
// when the app runs from source, so every read goes through `typeof`.
declare const __RELEASE_BUILD__: boolean | undefined;
declare const __UPDATE_SOURCE_OVERRIDE__: string | undefined;
