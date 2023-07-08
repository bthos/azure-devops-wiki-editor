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
            }
        });

        function contentChanged()
        {
            $(".we-ta-container textarea").val(editor.getMarkdown());
            $(".we-ta-container textarea")[0].dispatchEvent(new Event('input', { bubbles: true}));
        }
    }

    setTimeout(whenElementAppear, 500);
}

$(document).ready(function(){
    whenElementAppear();
});
