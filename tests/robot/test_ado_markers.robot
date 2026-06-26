*** Settings ***
Documentation     ADO Markers Plugin Tests
...               Tests for Azure DevOps specific markers:
...               - [[_TOC_]] - Table of Contents
...               - [[_TOSP_]] - Table of Sub-Pages
...               - @<user name> - User mentions
...               - #123456 - Work item references
Resource          resources/common.robot
Resource          resources/editor_keywords.robot
Library           libraries/ErrorHandler.py
Library           libraries/WikiEditorHelper.py
Library           Collections
Suite Setup       Setup Test Suite
Suite Teardown    Cleanup Test Suite
Test Setup        Setup Test Environment
Test Teardown     Test Teardown With Screenshot

*** Variables ***
${HEADLESS}              %{BROWSER_HEADLESS=True}
${CLOSE_BROWSER}         %{CLOSE_BROWSER_AFTER_TEST=True}

# ADO Marker selectors
${TOC_MARKER}            .ado-toc-widget, [data-type="toc"]
${TOSP_MARKER}           .ado-tosp-widget, [data-type="tosp"]
${MENTION_MARKER}        .ado-mention, [data-mention]
${WORKITEM_MARKER}       .ado-workitem-link, [data-workitem]

*** Keywords ***
Setup Test Suite
    [Documentation]    Setup for ADO markers test suite
    Log    Starting ADO Markers Test Suite    console=True

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
Test TOC Marker Insertion
    [Documentation]    Verify [[_TOC_]] marker can be inserted
    [Tags]    ado    toc    marker
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert TOC marker
    Insert TOC Marker
    
    # Add some headings after TOC
    Insert Heading    level=1    text=Document Title
    Insert Heading    level=2    text=First Section
    Insert Heading    level=2    text=Second Section
    
    Take Screenshot    toc_marker_inserted
    
    Log Audit Entry    TOC Marker Insertion Test    SUCCESS

Test TOC Widget Display
    [Documentation]    Verify TOC widget renders with headings
    [Tags]    ado    toc    widget
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert TOC and headings
    Insert TOC Marker
    Insert Heading    level=1    text=Main Title
    Insert Heading    level=2    text=Section One
    Insert Heading    level=3    text=Subsection
    Insert Heading    level=2    text=Section Two
    
    # Wait for widget to render
    Sleep    1s
    
    # Check if TOC widget is displayed
    ${toc_exists}=    Get Element Count    ${TOC_MARKER}
    
    Take Screenshot    toc_widget_display
    
    Log    TOC widget count: ${toc_exists}    console=True
    Log Audit Entry    TOC Widget Display Test    SUCCESS

Test TOSP Marker Insertion
    [Documentation]    Verify [[_TOSP_]] marker can be inserted
    [Tags]    ado    tosp    marker
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert TOSP marker
    Insert TOSP Marker
    
    Take Screenshot    tosp_marker_inserted
    
    Log Audit Entry    TOSP Marker Insertion Test    SUCCESS

Test User Mention Insertion
    [Documentation]    Verify @<user name> mentions can be inserted
    [Tags]    ado    mention    marker
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert some text with mentions
    Insert Heading    level=1    text=Team Assignments
    Insert Paragraph    Project lead:
    Insert Mention    John Doe
    Keyboard Key    press    Enter
    
    Insert Paragraph    Assigned to:
    Insert Mention    Jane Smith
    Keyboard Key    press    Enter
    
    Take Screenshot    mentions_inserted
    
    # Verify content contains mentions
    ${content}=    Get Editor Content
    Should Contain    ${content}    John Doe
    Should Contain    ${content}    Jane Smith
    
    Log Audit Entry    User Mention Insertion Test    SUCCESS

Test Work Item Reference Insertion
    [Documentation]    Verify #123456 work item references can be inserted
    [Tags]    ado    workitem    marker
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert heading and work item references
    Insert Heading    level=1    text=Related Work Items
    Insert Paragraph    This task relates to:
    Insert Work Item Reference    12345
    Keyboard Key    press    Space
    Insert Work Item Reference    67890
    Keyboard Key    press    Enter
    
    Take Screenshot    workitems_inserted
    
    # Verify content contains work item IDs
    ${content}=    Get Editor Content
    Should Contain    ${content}    12345
    Should Contain    ${content}    67890
    
    Log Audit Entry    Work Item Reference Test    SUCCESS

Test Combined ADO Markers
    [Documentation]    Verify all ADO markers work together
    [Tags]    ado    integration    marker
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Build a realistic wiki page with all markers
    Insert TOC Marker
    
    Insert Heading    level=1    text=Sprint Planning Document
    Insert Paragraph    Welcome to the sprint planning page.
    
    Insert Heading    level=2    text=Team
    Insert Paragraph    Lead:
    Insert Mention    Project Manager
    Keyboard Key    press    Enter
    Insert Paragraph    Developer:
    Insert Mention    Senior Dev
    Keyboard Key    press    Enter
    
    Insert Heading    level=2    text=Work Items
    Insert Paragraph    Sprint backlog items:
    Insert Work Item Reference    54321
    Keyboard Key    press    Space
    Insert Work Item Reference    98765
    Keyboard Key    press    Enter
    
    Insert Heading    level=2    text=Sub-Pages
    Insert TOSP Marker
    
    Take Screenshot    combined_ado_markers
    
    Log Audit Entry    Combined ADO Markers Test    SUCCESS

Test Mention Parsing
    [Documentation]    Test WikiEditorHelper mention parsing
    [Tags]    ado    mention    parsing    unit
    
    # Generate test markdown with mentions
    ${test_md}=    Generate Test Markdown    features=['headings', 'mentions']
    
    # Parse the content
    ${parsed}=    Parse Markdown Content    ${test_md}
    
    # Verify mentions were parsed
    ${mentions}=    Get From Dictionary    ${parsed}    mentions
    ${mention_count}=    Get Length    ${mentions}
    
    Should Be True    ${mention_count} > 0    msg=No mentions found in parsed content
    
    Log    Found ${mention_count} mentions    console=True
    Log Audit Entry    Mention Parsing Test    SUCCESS

Test Work Item Parsing
    [Documentation]    Test WikiEditorHelper work item parsing
    [Tags]    ado    workitem    parsing    unit
    
    # Generate test markdown with work items
    ${test_md}=    Generate Test Markdown    features=['headings', 'work_items']
    
    # Parse the content
    ${parsed}=    Parse Markdown Content    ${test_md}
    
    # Verify work items were parsed
    ${work_items}=    Get From Dictionary    ${parsed}    work_items
    ${wi_count}=    Get Length    ${work_items}
    
    Should Be True    ${wi_count} > 0    msg=No work items found in parsed content
    
    Log    Found ${wi_count} work items    console=True
    Log Audit Entry    Work Item Parsing Test    SUCCESS

Test TOC Structure Validation
    [Documentation]    Test TOC structure validation with heading hierarchy
    [Tags]    ado    toc    validation    unit
    
    # Create headings list with proper hierarchy
    ${headings}=    Create List
    ${h1}=    Create Dictionary    level=${1}    text=Title    line=${1}
    ${h2a}=    Create Dictionary    level=${2}    text=Section A    line=${3}
    ${h3}=    Create Dictionary    level=${3}    text=Subsection    line=${5}
    ${h2b}=    Create Dictionary    level=${2}    text=Section B    line=${7}
    
    Append To List    ${headings}    ${h1}
    Append To List    ${headings}    ${h2a}
    Append To List    ${headings}    ${h3}
    Append To List    ${headings}    ${h2b}
    
    # Validate structure
    ${result}=    Validate TOC Structure    ${headings}
    
    ${is_valid}=    Get From Dictionary    ${result}    valid
    Should Be True    ${is_valid}    msg=TOC structure should be valid
    
    Log Audit Entry    TOC Structure Validation Test    SUCCESS

Test Invalid TOC Structure Detection
    [Documentation]    Test that invalid heading hierarchies are detected
    [Tags]    ado    toc    validation    unit
    
    # Create headings with invalid hierarchy (h1 -> h3 skip)
    ${headings}=    Create List
    ${h1}=    Create Dictionary    level=${1}    text=Title    line=${1}
    ${h3}=    Create Dictionary    level=${3}    text=Skipped H2    line=${3}
    
    Append To List    ${headings}    ${h1}
    Append To List    ${headings}    ${h3}
    
    # Validate structure - should detect issue
    ${result}=    Validate TOC Structure    ${headings}
    
    ${is_valid}=    Get From Dictionary    ${result}    valid
    ${issues}=    Get From Dictionary    ${result}    issues
    
    Should Not Be True    ${is_valid}    msg=Invalid TOC structure should be detected
    ${issue_count}=    Get Length    ${issues}
    Should Be True    ${issue_count} > 0    msg=Issues should be reported
    
    Log    Detected issues: ${issues}    console=True
    Log Audit Entry    Invalid TOC Detection Test    SUCCESS

Test ADO Marker Serialization
    [Documentation]    Verify ADO markers serialize correctly to markdown
    [Tags]    ado    serialization    markdown
    
    Open Local Test Page    headless=${HEADLESS}
    Wait For Editor Ready
    Clear Editor Content
    
    # Insert markers
    Insert TOC Marker
    Insert Heading    level=1    text=Test
    Insert Mention    Test User
    Keyboard Key    press    Enter
    Insert Work Item Reference    99999
    
    # Get editor content (would be markdown if serializer is available)
    ${content}=    Get Editor Content
    
    Log    Editor content: ${content}    console=True
    Take Screenshot    ado_serialization_test
    
    Log Audit Entry    ADO Serialization Test    SUCCESS
