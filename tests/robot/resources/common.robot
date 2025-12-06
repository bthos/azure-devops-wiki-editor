*** Settings ***
Documentation     Common resource file with reusable keywords and variables
...               for ADO Wiki Editor extension testing
Library           Browser
Library           RequestsLibrary
Library           OperatingSystem
Library           Collections
Library           String
Library           DateTime
Library           ../libraries/ErrorHandler.py
Library           ../libraries/MilkdownHelper.py

*** Variables ***
${BROWSER_TIMEOUT}        30s
${RETRY_DELAY}            2s
${MAX_RETRIES}            3
${SCREENSHOT_DIR}         ${CURDIR}/../reports/screenshots

# Environment-based variables
${HEADLESS}               %{BROWSER_HEADLESS=True}
${ADO_ORG_URL}            %{ADO_ORG_URL=}
${ADO_PROJECT}            %{ADO_PROJECT=}
# Default uses CURDIR (resources/) -> ../../.. to reach project root
${LOCAL_TEST_URL}         %{LOCAL_TEST_URL=file://${CURDIR}/../../../playground.html}

# Milkdown selectors
${EDITOR_CONTAINER}       .milkdown
${PROSEMIRROR_EDITOR}     .ProseMirror
${TOC_WIDGET}             .ado-toc-widget
${TOSP_WIDGET}            .ado-tosp-widget

*** Keywords ***
Setup Test Environment
    [Documentation]    Initialize test environment and load configuration
    ${env_loaded}=    Load Environment Variables
    Log    Environment configuration loaded    console=True
    Create Directory    ${SCREENSHOT_DIR}
    Log    Test environment initialized successfully

Load Environment Variables
    [Documentation]    Load environment variables from .env file using python-dotenv
    TRY
        ${env_loaded}=    Load Dotenv File
        RETURN    ${env_loaded}
    EXCEPT    AS    ${error}
        Log    Warning: Could not load .env file: ${error}    WARN
        RETURN    ${False}
    END

Cleanup Test Environment
    [Documentation]    Cleanup test environment and close browser
    [Arguments]    ${close_browser}=${True}
    
    TRY
        Save Audit Log
    EXCEPT    AS    ${error}
        Log    Could not save audit log: ${error}    WARN
    END
    
    IF    ${close_browser}
        TRY
            Close Browser    ALL
            Log    Browser closed successfully    console=True
        EXCEPT
            Log    Browser already closed    DEBUG
        END
    END

Take Screenshot On Failure
    [Documentation]    Take screenshot when test fails (only if browser is open)
    ${timestamp}=    Get Current Date    result_format=%Y%m%d_%H%M%S
    ${screenshot_name}=    Set Variable    failure_${timestamp}
    
    # Check if browser is open before attempting screenshot
    ${browser_opened}=    Run Keyword And Return Status    Get Browser Catalog
    
    IF    ${browser_opened}
        TRY
            Take Screenshot    ${screenshot_name}
            Log    Screenshot saved: ${screenshot_name}    console=True
        EXCEPT    AS    ${error}
            ${is_no_page}=    Run Keyword And Return Status    Should Contain    ${error}    no page was open
            IF    not ${is_no_page}
                Log    Could not take screenshot: ${error}    WARN
            END
        END
    ELSE
        Log    No browser open for screenshot    DEBUG
    END

Log Audit Entry
    [Documentation]    Log an audit entry with action, status, and optional details
    [Arguments]    ${action}    ${status}    ${details}=${EMPTY}
    ${details_dict}=    Create Dictionary
    
    ${has_details}=    Run Keyword And Return Status    Should Not Be Equal    ${details}    ${EMPTY}
    IF    ${has_details}
        ${details_dict}=    Evaluate    ${details}
    END
    
    ErrorHandler.Log Audit Entry    ${action}    ${status}    ${details_dict}

Wait And Click Element
    [Documentation]    Wait for element and click with retry logic
    [Arguments]    ${locator}    ${timeout}=${BROWSER_TIMEOUT}
    Wait For Elements State    ${locator}    visible    timeout=${timeout}
    Click    ${locator}
    Log    Clicked element: ${locator}

Wait And Fill Text
    [Documentation]    Wait for element and fill text
    [Arguments]    ${locator}    ${text}    ${timeout}=${BROWSER_TIMEOUT}
    Wait For Elements State    ${locator}    visible    timeout=${timeout}
    Fill Text    ${locator}    ${text}
    Log    Filled text in: ${locator}

Wait For Editor Ready
    [Documentation]    Wait for Milkdown editor to be fully loaded
    [Arguments]    ${timeout}=${BROWSER_TIMEOUT}
    
    Wait For Elements State    ${EDITOR_CONTAINER}    visible    timeout=${timeout}
    Wait For Elements State    ${PROSEMIRROR_EDITOR}    visible    timeout=${timeout}
    
    # Wait for editor to be editable
    ${is_editable}=    Get Attribute    ${PROSEMIRROR_EDITOR}    contenteditable
    Should Be Equal    ${is_editable}    true    msg=Editor is not editable
    
    Log    Milkdown editor is ready    console=True
    Log Audit Entry    Wait For Editor    SUCCESS

Get Editor Content
    [Documentation]    Get the current content from the Milkdown editor
    [Arguments]    ${format}=text
    
    ${content}=    Get Text    ${PROSEMIRROR_EDITOR}
    RETURN    ${content}

Type In Editor
    [Documentation]    Type text into the Milkdown editor
    [Arguments]    ${text}
    
    Click    ${PROSEMIRROR_EDITOR}
    Keyboard Input    type    ${text}
    Log    Typed text into editor    console=True

Clear Editor Content
    [Documentation]    Clear all content from the editor
    Click    ${PROSEMIRROR_EDITOR}
    Keyboard Key    press    Control+A
    Keyboard Key    press    Delete
    Log    Cleared editor content    console=True

Open Local Test Page
    [Documentation]    Open the local test HTML page
    [Arguments]    ${headless}=${HEADLESS}
    
    New Browser    chromium    headless=${headless}
    New Page    ${LOCAL_TEST_URL}
    
    Log Audit Entry    Open Test Page    SUCCESS    {'url': '${LOCAL_TEST_URL}'}
    Log    Opened local test page: ${LOCAL_TEST_URL}    console=True

Close Application
    [Documentation]    Close browser and cleanup
    Close Browser    ALL
    Log Audit Entry    Close Browser    SUCCESS
