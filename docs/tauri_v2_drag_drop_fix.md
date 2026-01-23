# Resolution: Tauri v2 Drag-and-Drop Implementation

**Date:** 2026-01-23
**Issue:** Drag-and-drop file opening was not working.
**Environment:** Tauri v2, macOS

## Problem Description
The application was configured to allow drag-and-drop (`"dragDropEnabled": true` in `tauri.conf.json`), but the event listener in the frontend was never triggering.
The frontend was listening for the event `tauri://file-drop`.

## Root Cause
The event name `tauri://file-drop` is specific to **Tauri v1**.
In **Tauri v2**, the drag-and-drop system was refactored, and the event names were changed to align better with standard drag-and-drop terminology.

## Solution

### 1. Update Event Names
We replaced the v1 event listeners with v2 equivalents:

| Action | Tauri v1 Event | Tauri v2 Event |
|--------|----------------|----------------|
| File Drop | `tauri://file-drop` | `tauri://drag-drop` |
| Hover Enter | `tauri://file-drop-hover` | `tauri://drag-enter` |
| Hover Leave | `tauri://file-drop-cancelled` | `tauri://drag-leave` |

### 2. Handle Payload Structure
The payload structure for the drop event has changed.
- **v1**: Payload was directly an array of file paths: `string[]`.
- **v2**: Payload is an object containing both paths and cursor position: `{ paths: string[], position: { x: number, y: number } }`.

**Implementation fix:**
```javascript
await listen('tauri://drag-drop', async (event) => {
    const payload = event.payload;
    // robust check for direct array or object property
    const paths = payload.paths || payload; 
    
    if (Array.isArray(paths) && paths.length > 0) {
        // ... process file
    }
});
```

## Additional Improvements
We also implemented a visual overlay using `tauri://drag-enter` and `tauri://drag-leave` to give the user feedback that the file can be dropped.

## References
- Tauri v2 Migration Guide (General changes)
- Tauri v2 Wry/WebView interaction
