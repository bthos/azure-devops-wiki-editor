var enableFilter = true;

function whenElementAppear()
{
    if($(".we-ta-container textarea:visible").length>0)
    {
        var content = $(".we-ta-container textarea").val();
        $(".wiki-editor .we-text-preview-container").css("display","none");
        $(".wiki-editor").append("<div id='new-editor'></div>");
        var editor = new toastui.Editor({
            el: document.querySelector('#new-editor'),
            height: 'auto',
            initialEditType: 'wysiwyg',
            previewStyle: 'vertical',
            initialValue: content,
            events: {
                change: contentChanged
            },
            customHTMLRenderer: {
                emph: (node, context) => {
                    if (node.literal === '[[_TOC_]]') {
                        return entering ? '[[_TOC_]]' : '';
                    }
                    return context ? '**' : '**';
                }
            },
            usageStatistics: false
        });

        function contentChanged()
        {
            $(".we-ta-container textarea").val(editor.getMarkdown());
            $(".we-ta-container textarea")[0].dispatchEvent(new Event('input', { bubbles: true}));
        }

        // Add custom buttons to switch between edit types
        var markdownButton = createApplyButton(i18n.get('Markdown'));
        markdownButton.addEventListener('click', () => {
                editor.changeMode('markdown');
            });
        var wysiwygButton = $('<button>').text('WYSIWYG').click(function() {
                editor.changeMode('wysiwyg');
            });
        $('.toastui-editor-header').prepend(markdownButton, wysiwygButton);

        // Add hooks to handle custom events and prevent errors
        editor.addHook('renderMarkdown', function() {
            // Custom rendering logic here
        });
    }

    setTimeout(whenElementAppear, 500);
}

$(document).ready(function(){
    whenElementAppear();
});