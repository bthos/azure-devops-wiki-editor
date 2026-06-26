# ADO Wiki Editor - Robot Framework Tests

Automated testing framework for the Azure DevOps Wiki Editor browser extension using Robot Framework and Playwright.

Based on the [robot-automation-blueprint](https://github.com/bthos/robot-automation-blueprint) template.

## Features

- **UI Automation**: Browser-based testing using Playwright (Browser Library)
- **Wiki WYSIWYG testing**: Keywords for the ProseMirror wiki editor
- **ADO Markers Testing**: Tests for TOC, TOSP, mentions, and work item references
- **Comprehensive Reporting**: HTML reports, logs, and screenshots
- **Audit Trail**: Complete logging of all automation actions
- **Error Handling**: Built-in retry logic and graceful error handling

## Prerequisites

- **Python 3.10 or higher**
- **Node.js 18.18.0 or higher** (for Playwright)
- Git Bash or equivalent shell (for Windows users)

## Quick Start

### 1. Setup Environment

```bash
cd tests
./setup.sh
```

### 2. Configure Environment

Edit `.env` file with your settings:
```env
# Local test page (relative to tests/)
LOCAL_TEST_URL=../playground.html

# Browser configuration
BROWSER_HEADLESS=True
```

### 3. Run Tests

```bash
# From the tests/ directory
cd robot

# Activate virtual environment
source venv/Scripts/activate  # On Windows Git Bash
# source venv/bin/activate    # On Linux/Mac

# Run all tests
robot --outputdir reports *.robot

# Run with browser visible
BROWSER_HEADLESS=False robot --outputdir reports *.robot

# Run specific test suite
robot --outputdir reports test_editor_basic.robot

# Run tests by tag
robot --outputdir reports --include smoke *.robot
```

Or use the test runner script from `tests/`:
```bash
./run_tests.sh                              # Run all tests
./run_tests.sh --browser                    # Run with visible browser
./run_tests.sh --tag smoke                  # Run smoke tests only
./run_tests.sh --suite test_ado_markers.robot  # Run specific suite
```

## Project Structure

```plaintext
tests/
├── setup.sh                     # Setup script
├── run_tests.sh                 # Test runner script
├── README.md                    # This file
├── .gitignore                   # Git ignore for tests
├── .env.example                 # Environment variables template
├── .env                         # Your configuration (never commit!)
└── robot/                       # Robot Framework files
    ├── test_editor_basic.robot  # Basic editor functionality tests
    ├── test_ado_markers.robot   # ADO markers (TOC, TOSP, mentions, work items)
    ├── resources/               # Reusable Robot Framework resources
    │   ├── common.robot         # Common keywords and variables
    │   └── editor_keywords.robot# Wiki editor keywords
    ├── libraries/               # Python libraries
    │   ├── ErrorHandler.py      # Error handling and retry logic
    │   └── WikiEditorHelper.py  # Wiki editor helper utilities
    ├── data/                    # Test data files
    ├── reports/                 # Generated reports (auto-created)
    ├── logs/                    # Log files (auto-created)
    └── requirements.txt         # Python dependencies
```

## Test Suites

### test_editor_basic.robot
Basic wiki editor functionality tests:
- Editor loading
- Text input
- Heading insertion
- Bold/italic formatting
- Link insertion
- Code block insertion
- Undo/redo functionality
- Content persistence

### test_ado_markers.robot
Azure DevOps specific markers tests:
- `[[_TOC_]]` - Table of Contents marker and widget
- `[[_TOSP_]]` - Table of Sub-Pages marker
- `@<user name>` - User mentions
- `#123456` - Work item references
- Combined marker scenarios
- Markdown parsing validation

## Tags

Use tags to run specific test categories:

| Tag | Description |
|-----|-------------|
| `smoke` | Quick validation tests |
| `editor` | Editor-related tests |
| `ado` | ADO-specific marker tests |
| `toc` | TOC marker tests |
| `tosp` | TOSP marker tests |
| `mention` | User mention tests |
| `workitem` | Work item reference tests |
| `formatting` | Text formatting tests |
| `ui` | Browser UI tests |
| `unit` | Unit/parsing tests |

Example:
```bash
robot --outputdir reports --include smoke *.robot
robot --outputdir reports --include ado --exclude unit *.robot
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LOCAL_TEST_URL` | Yes | Path to playground.html file |
| `BROWSER_HEADLESS` | No | Run browser in headless mode (default: True) |
| `BROWSER_TIMEOUT` | No | Browser timeout in seconds (default: 30) |
| `ADO_ORG_URL` | No | Azure DevOps organization URL |
| `ADO_PROJECT` | No | Azure DevOps project name |

### Browser Settings

Control browser behavior via environment variables:
```bash
# Run with visible browser
BROWSER_HEADLESS=False robot --outputdir reports *.robot

# Increase timeout for slow connections
BROWSER_TIMEOUT=60 robot --outputdir reports *.robot
```

## Reports

After test execution, reports are generated in `reports/`:

- **report.html** - Comprehensive HTML report
- **log.html** - Detailed execution log
- **output.xml** - Machine-readable XML results
- **audit_log_*.json** - Audit trail of automation actions
- **screenshots/** - Screenshots from test execution

## Keywords Reference

### Common Keywords (resources/common.robot)

| Keyword | Description |
|---------|-------------|
| `Setup Test Environment` | Initialize test environment |
| `Open Local Test Page` | Open the test HTML page |
| `Wait For Editor Ready` | Wait for wiki editor to load |
| `Get Editor Content` | Get current editor content |
| `Type In Editor` | Type text into editor |
| `Clear Editor Content` | Clear all editor content |
| `Take Screenshot On Failure` | Auto-screenshot on error |

### Editor Keywords (resources/editor_keywords.robot)

| Keyword | Description |
|---------|-------------|
| `Insert Heading` | Insert a heading (H1-H6) |
| `Insert Paragraph` | Insert paragraph text |
| `Insert Code Block` | Insert a code block |
| `Insert Link` | Insert a markdown link |
| `Insert TOC Marker` | Insert [[_TOC_]] |
| `Insert TOSP Marker` | Insert [[_TOSP_]] |
| `Insert Mention` | Insert @<user name> |
| `Insert Work Item Reference` | Insert #12345 |
| `Verify Heading Exists` | Verify heading is displayed |
| `Apply Bold Formatting` | Apply bold (Ctrl+B) |
| `Apply Italic Formatting` | Apply italic (Ctrl+I) |

### Python Libraries

#### ErrorHandler.py

| Method | Description |
|--------|-------------|
| `execute_with_retry` | Execute keyword with retry logic |
| `log_audit_entry` | Log action to audit trail |
| `save_audit_log` | Save audit log to JSON file |
| `handle_error` | Handle errors with logging |

#### WikiEditorHelper.py

| Method | Description |
|--------|-------------|
| `get_editor_selector` | Get CSS selector for editor elements |
| `parse_markdown_content` | Parse markdown and extract structure |
| `validate_toc_structure` | Validate TOC heading hierarchy |
| `generate_test_markdown` | Generate test markdown content |
| `compare_markdown` | Compare two markdown strings |

## Troubleshooting

### Browser/Playwright Issues

**Problem**: "Could not connect to playwright process"

**Solution**:
```bash
# Check Node.js version (must be 18.18.0+)
node --version

# Reinitialize Playwright
source venv/Scripts/activate
rfbrowser init chromium
```

### Missing Dependencies

**Problem**: ModuleNotFoundError

**Solution**:
```bash
source venv/Scripts/activate
pip install -r requirements.txt
```

### Test Page Not Found

**Problem**: Tests fail with "page not found"

**Solution**:
1. Verify `LOCAL_TEST_URL` in `tests/.env` points to correct `playground.html` path
2. Use relative path: `../playground.html` (relative to tests/)

## CI/CD Integration

### GitHub Actions

```yaml
name: Robot Framework Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd tests/robot
          pip install -r requirements.txt
          rfbrowser init chromium
      
      - name: Run tests
        run: |
          cd tests/robot
          robot --outputdir reports *.robot
        env:
          BROWSER_HEADLESS: True
          LOCAL_TEST_URL: file://${{ github.workspace }}/playground.html
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: robot-reports
          path: tests/robot/reports/
```

## Contributing

1. Follow the project structure when adding new tests
2. Use meaningful test names and documentation
3. Apply appropriate tags to test cases
4. Add new keywords to appropriate resource files
5. Update README when adding new features

## License

This test framework is part of the ADO Wiki Editor project.
