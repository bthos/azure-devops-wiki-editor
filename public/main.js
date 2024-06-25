var enableFilter = true;

function whenElementAppear() {
    if ($(".we-ta-container textarea:visible").length > 0) {
        var content = $(".we-ta-container textarea").val();
        $(".wiki-editor .we-text-preview-container").css("display", "none");
        $(".wiki-editor").append("<div id='new-editor'></div>");
        var editor = new toastui.Editor({
            el: document.querySelector('#new-editor'),
            height: 'auto',
            initialEditType: 'wysiwyg',
            previewStyle: 'vertical',
            initialValue: content,
            events: {
                change: contentChanged,
                renderMarkdown: handleMentionsInTables // Adding missing 'renderMarkdown' event type
            },
            hooks: {
                addImageBlobHook: function (blob, callback) {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        callback(e.target.result, blob.name);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        });

        function contentChanged() {
            $(".we-ta-container textarea").val(editor.getMarkdown());
            $(".we-ta-container textarea")[0].dispatchEvent(new Event('input', { bubbles: true }));
        }

        function handleMentionsInTables(markdown) {
            // Regular expression to match @ mentions within tables
            var mentionRegex = /(\|[^|]*?)@(\w+)([^|]*?\|)/g;
            // Replace mentions with a span tag to avoid disrupting table formatting
            return markdown.replace(mentionRegex, function (match, p1, p2, p3) {
                return `${p1}<span class="mention">@${p2}</span>${p3}`;
            });
        }
    }

    setTimeout(whenElementAppear, 500);
}

$(document).ready(function () {
    whenElementAppear();
});