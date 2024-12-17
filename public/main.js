const enableFilter = true;

const initializeEditor = (content) => {
    const editor = new toastui.Editor({
        el: document.querySelector('#new-editor'),
        height: 'auto',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        initialValue: content,
        events: {
            change: () => contentChanged(editor)
        },
        usageStatistics: false
    });
};

const contentChanged = (editor) => {
    const textarea = $(".we-ta-container textarea");
    textarea.val(editor.getMarkdown());
    textarea[0].dispatchEvent(new Event('input', { bubbles: true }));
};

const whenElementAppear = () => {
    const textarea = $(".we-ta-container textarea:visible");
    if (textarea.length > 0) {
        const content = textarea.val();
        $(".wiki-editor .we-text-preview-container").css("display", "none");
        $(".wiki-editor").append("<div id='new-editor'></div>");
        initializeEditor(content);
    }
    setTimeout(whenElementAppear, 500);
};

$(document).ready(() => {
    whenElementAppear();
});
