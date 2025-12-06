*** Settings ***
Documentation     Keywords for Milkdown editor interactions
...               Provides high-level keywords for testing editor functionality
Library           Browser
Library           Collections
Library           String
Resource          common.robot

*** Variables ***
# Editor element selectors
${TOOLBAR_CONTAINER}      .milkdown-toolbar, [class*="toolbar"]
${BOLD_BUTTON}            button[data-type="bold"], [aria-label*="Bold"]
${ITALIC_BUTTON}          button[data-type="italic"], [aria-label*="Italic"]
${HEADING_BUTTON}         button[data-type="heading"], [aria-label*="Heading"]
${LINK_BUTTON}            button[data-type="link"], [aria-label*="Link"]
${CODE_BUTTON}            button[data-type="code"], [aria-label*="Code"]
${LIST_BUTTON}            button[data-type="bullet_list"], [aria-label*="List"]

# Content selectors
${HEADING_H1}             ${PROSEMIRROR_EDITOR} h1
${HEADING_H2}             ${PROSEMIRROR_EDITOR} h2
${HEADING_H3}             ${PROSEMIRROR_EDITOR} h3
${PARAGRAPH}              ${PROSEMIRROR_EDITOR} p
${CODE_BLOCK}             ${PROSEMIRROR_EDITOR} pre code
${LINK_ELEMENT}           ${PROSEMIRROR_EDITOR} a
${TABLE_ELEMENT}          ${PROSEMIRROR_EDITOR} table

*** Keywords ***
Verify Editor Is Loaded
    [Documentation]    Verify the Milkdown editor is properly loaded
    
    Wait For Elements State    ${EDITOR_CONTAINER}    visible    timeout=10s
    Wait For Elements State    ${PROSEMIRROR_EDITOR}    visible    timeout=10s
    
    ${editor_exists}=    Get Element Count    ${EDITOR_CONTAINER}
    Should Be True    ${editor_exists} > 0    msg=Milkdown editor container not found
    
    ${prosemirror_exists}=    Get Element Count    ${PROSEMIRROR_EDITOR}
    Should Be True    ${prosemirror_exists} > 0    msg=ProseMirror editor not found
    
    Log Audit Entry    Verify Editor Loaded    SUCCESS

Insert Heading
    [Documentation]    Insert a heading at the current cursor position
    [Arguments]    ${level}=1    ${text}=Test Heading
    
    Click    ${PROSEMIRROR_EDITOR}
    
    # Type markdown heading syntax
    ${hashes}=    Evaluate    '#' * ${level}
    Type In Editor    ${hashes} ${text}
    Keyboard Key    press    Enter
    
    Log    Inserted H${level} heading: ${text}    console=True
    Log Audit Entry    Insert Heading    SUCCESS    {'level': ${level}, 'text': '${text}'}

Insert Paragraph
    [Documentation]    Insert a paragraph at the current cursor position
    [Arguments]    ${text}
    
    Type In Editor    ${text}
    Keyboard Key    press    Enter
    
    Log    Inserted paragraph    console=True

Insert Code Block
    [Documentation]    Insert a code block with optional language
    [Arguments]    ${code}    ${language}=
    
    Type In Editor    \`\`\`${language}
    Keyboard Key    press    Enter
    Type In Editor    ${code}
    Keyboard Key    press    Enter
    Type In Editor    \`\`\`
    Keyboard Key    press    Enter
    
    Log    Inserted code block    console=True
    Log Audit Entry    Insert Code Block    SUCCESS    {'language': '${language}'}

Insert Link
    [Documentation]    Insert a markdown link
    [Arguments]    ${text}    ${url}
    
    Type In Editor    [${text}](${url})
    
    Log    Inserted link: ${text} -> ${url}    console=True
    Log Audit Entry    Insert Link    SUCCESS    {'text': '${text}', 'url': '${url}'}

Insert TOC Marker
    [Documentation]    Insert [[_TOC_]] marker
    
    Type In Editor    [[_TOC_]]
    Keyboard Key    press    Enter
    
    Log    Inserted TOC marker    console=True
    Log Audit Entry    Insert TOC Marker    SUCCESS

Insert TOSP Marker
    [Documentation]    Insert [[_TOSP_]] marker
    
    Type In Editor    [[_TOSP_]]
    Keyboard Key    press    Enter
    
    Log    Inserted TOSP marker    console=True
    Log Audit Entry    Insert TOSP Marker    SUCCESS

Insert Mention
    [Documentation]    Insert a user mention
    [Arguments]    ${user_name}
    
    Type In Editor    @<${user_name}>
    
    Log    Inserted mention: ${user_name}    console=True
    Log Audit Entry    Insert Mention    SUCCESS    {'user': '${user_name}'}

Insert Work Item Reference
    [Documentation]    Insert a work item reference
    [Arguments]    ${work_item_id}
    
    Type In Editor    #${work_item_id}
    
    Log    Inserted work item reference: #${work_item_id}    console=True
    Log Audit Entry    Insert Work Item Reference    SUCCESS    {'id': '${work_item_id}'}

Insert Table
    [Documentation]    Insert a markdown table
    [Arguments]    ${rows}=2    ${cols}=3
    
    # Create header row
    ${header_cells}=    Evaluate    ' | '.join(['Header ' + str(i+1) for i in range(${cols})])
    Type In Editor    | ${header_cells} |
    Keyboard Key    press    Enter
    
    # Create separator row
    ${separator}=    Evaluate    ' | '.join(['---' for _ in range(${cols})])
    Type In Editor    | ${separator} |
    Keyboard Key    press    Enter
    
    # Create data rows
    FOR    ${row}    IN RANGE    ${rows}
        ${cells}=    Evaluate    ' | '.join(['Cell ' + str(${row}+1) + '-' + str(i+1) for i in range(${cols})])
        Type In Editor    | ${cells} |
        Keyboard Key    press    Enter
    END
    
    Log    Inserted ${rows}x${cols} table    console=True
    Log Audit Entry    Insert Table    SUCCESS    {'rows': ${rows}, 'cols': ${cols}}

Verify Heading Exists
    [Documentation]    Verify a heading with specific level and text exists
    [Arguments]    ${level}    ${text}
    
    ${selector}=    Set Variable    ${PROSEMIRROR_EDITOR} h${level}
    ${headings}=    Get Elements    ${selector}
    ${count}=    Get Length    ${headings}
    
    Should Be True    ${count} > 0    msg=No h${level} headings found
    
    ${found}=    Set Variable    ${False}
    FOR    ${heading}    IN    @{headings}
        ${heading_text}=    Get Text    ${heading}
        ${matches}=    Run Keyword And Return Status    Should Contain    ${heading_text}    ${text}
        IF    ${matches}
            ${found}=    Set Variable    ${True}
            BREAK
        END
    END
    
    Should Be True    ${found}    msg=Heading "${text}" not found at level h${level}
    Log    Found heading: h${level} "${text}"    console=True

Verify TOC Widget Displayed
    [Documentation]    Verify the TOC widget is displayed
    
    ${widget_exists}=    Get Element Count    ${TOC_WIDGET}
    Should Be True    ${widget_exists} > 0    msg=TOC widget not displayed
    
    Log    TOC widget is displayed    console=True
    Log Audit Entry    Verify TOC Widget    SUCCESS

Verify TOSP Widget Displayed
    [Documentation]    Verify the TOSP widget is displayed
    
    ${widget_exists}=    Get Element Count    ${TOSP_WIDGET}
    Should Be True    ${widget_exists} > 0    msg=TOSP widget not displayed
    
    Log    TOSP widget is displayed    console=True
    Log Audit Entry    Verify TOSP Widget    SUCCESS

Verify Link Exists
    [Documentation]    Verify a link with specific text exists
    [Arguments]    ${link_text}
    
    ${links}=    Get Elements    ${LINK_ELEMENT}
    ${count}=    Get Length    ${links}
    
    Should Be True    ${count} > 0    msg=No links found in editor
    
    ${found}=    Set Variable    ${False}
    FOR    ${link}    IN    @{links}
        ${text}=    Get Text    ${link}
        ${matches}=    Run Keyword And Return Status    Should Contain    ${text}    ${link_text}
        IF    ${matches}
            ${found}=    Set Variable    ${True}
            BREAK
        END
    END
    
    Should Be True    ${found}    msg=Link "${link_text}" not found

Verify Code Block Exists
    [Documentation]    Verify a code block exists with optional content check
    [Arguments]    ${expected_content}=${EMPTY}
    
    ${code_blocks}=    Get Element Count    ${CODE_BLOCK}
    Should Be True    ${code_blocks} > 0    msg=No code blocks found
    
    IF    '${expected_content}' != '${EMPTY}'
        ${code_text}=    Get Text    ${CODE_BLOCK}
        Should Contain    ${code_text}    ${expected_content}
    END
    
    Log    Code block found    console=True

Verify Table Exists
    [Documentation]    Verify a table exists in the editor
    
    ${tables}=    Get Element Count    ${TABLE_ELEMENT}
    Should Be True    ${tables} > 0    msg=No tables found in editor
    
    Log    Table found    console=True

Count Headings
    [Documentation]    Count the number of headings at a specific level
    [Arguments]    ${level}
    
    ${selector}=    Set Variable    ${PROSEMIRROR_EDITOR} h${level}
    ${count}=    Get Element Count    ${selector}
    
    RETURN    ${count}

Get All Headings
    [Documentation]    Get all headings from the editor
    
    ${all_headings}=    Create List
    
    FOR    ${level}    IN RANGE    1    7
        ${selector}=    Set Variable    ${PROSEMIRROR_EDITOR} h${level}
        ${headings}=    Get Elements    ${selector}
        
        FOR    ${heading}    IN    @{headings}
            ${text}=    Get Text    ${heading}
            ${heading_data}=    Create Dictionary    level=${level}    text=${text}
            Append To List    ${all_headings}    ${heading_data}
        END
    END
    
    RETURN    ${all_headings}

Apply Bold Formatting
    [Documentation]    Apply bold formatting to selected text
    
    Keyboard Key    press    Control+B
    Log    Applied bold formatting    console=True

Apply Italic Formatting
    [Documentation]    Apply italic formatting to selected text
    
    Keyboard Key    press    Control+I
    Log    Applied italic formatting    console=True

Select All Content
    [Documentation]    Select all content in the editor
    
    Click    ${PROSEMIRROR_EDITOR}
    Keyboard Key    press    Control+A
    Log    Selected all content    console=True

Undo Last Action
    [Documentation]    Undo the last action
    
    Keyboard Key    press    Control+Z
    Log    Undid last action    console=True

Redo Last Action
    [Documentation]    Redo the last undone action
    
    Keyboard Key    press    Control+Y
    Log    Redid last action    console=True
