*** Settings ***
Documentation     Basic Milkdown Editor Tests
...               Tests for core editor functionality including loading,
...               basic text editing, and formatting features.
Resource          resources/common.robot
Resource          resources/editor_keywords.robot
Library           libraries/ErrorHandler.py
Library           libraries/MilkdownHelper.py
Library           Collections
Suite Setup       Setup Test Suite
Suite Teardown    Cleanup Test Suite
Test Setup        Setup Test Environment
Test Teardown     Test Teardown With Screenshot

*** Variables ***
${HEADLESS}              %{BROWSER_HEADLESS=True}
${CLOSE_BROWSER}         %{CLOSE_BROWSER_AFTER_TEST=True}

*** Keywords ***
Setup Test Suite
    [Documentation]    Setup for test suite
    Log    Starting Editor Basic Test Suite    console=True

Cleanup Test Suite
    [Documentation]    Cleanup after test suite
    Cleanup Test Environment    close_browser=${CLOSE_BROWSER}

Test Teardown With Screenshot
    [Documentation]    Teardown with screenshot on failure
    Run Keyword If Test Failed    Take Screenshot On Failure
    IF    '${CLOSE_BROWSER}' == 'True'
        TRY
            Close Application
        EXCEPT
            Log    Browser already closed    DEBUG
        END
    END

*** Test Cases ***
Test Editor Loads Successfully
    [Documentation]    Verify the Milkdown editor loads and is ready for input
    [Tags]    smoke    editor    ui
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Verify Editor Is Loaded
    
    Log Audit Entry    Editor Load Test    SUCCESS

Test Basic Text Input
    [Documentation]    Verify basic text can be typed into the editor
    [Tags]    smoke    editor    input
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    
    # Clear any existing content
    Clear Editor Content
    
    # Type test text
    ${test_text}=    Set Variable    Hello, this is a test paragraph.
    Type In Editor    ${test_text}
    
    # Verify text was inserted
    ${content}=    Get Editor Content
    Should Contain    ${content}    Hello
    
    Log Audit Entry    Basic Text Input Test    SUCCESS

Test Insert Heading
    [Documentation]    Verify headings can be inserted at different levels
    [Tags]    editor    formatting    heading
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert H1 heading
    Insert Heading    level=1    text=Main Title
    
    # Insert H2 heading
    Insert Heading    level=2    text=Section Title
    
    # Insert H3 heading
    Insert Heading    level=3    text=Subsection Title
    
    # Verify headings exist
    Verify Heading Exists    1    Main Title
    Verify Heading Exists    2    Section Title
    Verify Heading Exists    3    Subsection Title
    
    Log Audit Entry    Insert Heading Test    SUCCESS

Test Bold Formatting
    [Documentation]    Verify bold formatting can be applied
    [Tags]    editor    formatting
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Type text and apply bold
    Type In Editor    Test bold text
    Select All Content
    Apply Bold Formatting
    
    # Take screenshot to verify visual formatting
    Take Screenshot    bold_formatting_test
    
    Log Audit Entry    Bold Formatting Test    SUCCESS

Test Italic Formatting
    [Documentation]    Verify italic formatting can be applied
    [Tags]    editor    formatting
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Type text and apply italic
    Type In Editor    Test italic text
    Select All Content
    Apply Italic Formatting
    
    Take Screenshot    italic_formatting_test
    
    Log Audit Entry    Italic Formatting Test    SUCCESS

Test Insert Link
    [Documentation]    Verify links can be inserted
    [Tags]    editor    link
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert a link
    Insert Link    Azure DevOps    https://dev.azure.com
    Keyboard Key    press    Enter
    
    # Verify link exists
    Verify Link Exists    Azure DevOps
    
    Log Audit Entry    Insert Link Test    SUCCESS

Test Insert Code Block
    [Documentation]    Verify code blocks can be inserted
    [Tags]    editor    code
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert code block with TypeScript
    Insert Code Block    const x = 1;    typescript
    
    # Wait for rendering
    Sleep    1s
    
    Take Screenshot    code_block_test
    
    Log Audit Entry    Insert Code Block Test    SUCCESS

Test Undo Redo Functionality
    [Documentation]    Verify undo and redo operations work
    [Tags]    editor    undo    redo
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Type text
    Type In Editor    Original text
    
    # Get content before undo
    ${before_undo}=    Get Editor Content
    Should Contain    ${before_undo}    Original
    
    # Undo
    Undo Last Action
    Sleep    0.5s
    
    # Redo
    Redo Last Action
    Sleep    0.5s
    
    ${after_redo}=    Get Editor Content
    Log    Content after redo: ${after_redo}    console=True
    
    Log Audit Entry    Undo Redo Test    SUCCESS

Test Multiple Paragraphs
    [Documentation]    Verify multiple paragraphs can be inserted
    [Tags]    editor    paragraph
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert multiple paragraphs
    Insert Paragraph    First paragraph content.
    Insert Paragraph    Second paragraph content.
    Insert Paragraph    Third paragraph content.
    
    # Verify content
    ${content}=    Get Editor Content
    Should Contain    ${content}    First
    Should Contain    ${content}    Second
    Should Contain    ${content}    Third
    
    Log Audit Entry    Multiple Paragraphs Test    SUCCESS

Test Editor Content Persistence
    [Documentation]    Verify content persists during editing session
    [Tags]    editor    persistence
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Add various content
    Insert Heading    level=1    text=Test Document
    Insert Paragraph    This is a test paragraph.
    Insert Link    Test Link    https://example.com
    
    # Get final content
    ${content}=    Get Editor Content
    
    # Verify all content present
    Should Contain    ${content}    Test Document
    Should Contain    ${content}    test paragraph
    
    Take Screenshot    content_persistence_test
    
    Log Audit Entry    Content Persistence Test    SUCCESS
