var enableFilter = true;

function whenElementAppear() {
    if($(".we-ta-container textarea:visible").length>0) {
        var content = $(".we-ta-container textarea").val();
        $(".wiki-editor .we-text-preview-container").css("display","none");
        $(".wiki-editor").append("<div id='new-editor'></div>");
        
        // Find the form that contains our textarea
        const form = $(".we-ta-container textarea").closest('form');
        const textarea = $(".we-ta-container textarea")[0];
        
        var editor = new toastui.Editor({
            el: document.querySelector('#new-editor'),
            height: 'auto',
            initialEditType: 'wysiwyg',
            previewStyle: 'vertical',
            initialValue: content,
            events: {
                change: () => {
                    // Get current content and fix special markers
                    const currentContent = editor.getMarkdown()
                        .replace(/\[\[\*TOC\*\]\]/g, '[[_TOC_]]')
                        .replace(/\[\[\*TOSP\*\]\]/g, '[[_TOSP_]]')
                        .replace(/@([a-zA-Z0-9._-]+)/g, (match) => match);
                    
                    // Update textarea and trigger events for Azure DevOps to detect the change
                    textarea.value = currentContent;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                }
            },
            customHTMLRenderer: {
                text: (node) => {
                    // Handle [[_TOC_]], [[_TOSP_]] and @ mentions
                    const text = node.literal || '';
                    if (text === '[[_TOC_]]' || text === '[[_TOSP_]]') {
                        return {
                            type: 'text',
                            content: text,
                            openTag: '<span class="toc-marker">',
                            closeTag: '</span>'
                        };
                    }
                    // Match complete @ mention pattern
                    if (/@[a-zA-Z0-9._-]+/.test(text)) {
                        return {
                            type: 'text',
                            content: text,
                            openTag: '<span class="mention">',
                            closeTag: '</span>'
                        };
                    }
                    return null;
                }
            },
            toolbarItems: [
                ['heading', 'bold', 'italic', 'strike'],
                ['hr', 'quote'],
                ['ul', 'ol', 'task', 'indent', 'outdent'],
                ['table', 'link'],
                ['code', 'codeblock']
            ]
        });

        // Handle form submission
        form.on('submit', function(e) {
            // Get current content and fix special markers
            const currentContent = editor.getMarkdown()
                .replace(/\[\[\*TOC\*\]\]/g, '[[_TOC_]]')
                .replace(/\[\[\*TOSP\*\]\]/g, '[[_TOSP_]]')
                .replace(/@([a-zA-Z0-9._-]+)/g, (match) => match);
            
            // Update textarea value before form submission
            textarea.value = currentContent;
        });
    }

    setTimeout(whenElementAppear, 500);
}

$(document).ready(function(){
    whenElementAppear();
});

