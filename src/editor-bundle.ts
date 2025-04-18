// Import the editor and explicitly attach it to the window object
import { Editor } from '@toast-ui/editor';

// Make the editor available globally
(window as any).toastui = {
    ...(window as any).toastui,
    Editor: Editor
};

// Export to make webpack happy
export default Editor;