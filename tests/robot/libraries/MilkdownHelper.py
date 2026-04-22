"""
Milkdown Editor Helper Library for Robot Framework

Provides keywords for interacting with the Milkdown editor
in the ADO Wiki Editor extension tests.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv


class MilkdownHelper:
    """Library for Milkdown editor interactions in Robot Framework tests."""
    
    ROBOT_LIBRARY_SCOPE = 'GLOBAL'
    
    # CSS Selectors for Milkdown elements
    SELECTORS = {
        'editor_container': '.wiki-editor-shell',
        'prosemirror': '.ProseMirror',
        'toolbar': '.wiki-editor-toolbar, [class*="toolbar"]',
        'toc_widget': '.ado-toc-widget',
        'tosp_widget': '.ado-tosp-widget',
        'mention': '.ado-mention, [data-mention]',
        'work_item': '.ado-workitem-link, [data-workitem]',
        'code_block': 'pre code, .code-block',
        'heading': 'h1, h2, h3, h4, h5, h6',
        'link': 'a[href]',
        'image': 'img',
        'table': 'table',
        'list_item': 'li',
        'blockquote': 'blockquote',
    }
    
    def __init__(self):
        """Initialize the Milkdown helper."""
        load_dotenv()
    
    def get_editor_selector(self, element: str = 'editor_container') -> str:
        """Get CSS selector for a Milkdown element.
        
        Args:
            element: Name of the element (see SELECTORS)
            
        Returns:
            CSS selector string
        """
        return self.SELECTORS.get(element, element)
    
    def parse_markdown_content(self, markdown: str) -> Dict[str, Any]:
        """Parse markdown content and extract structure.
        
        Args:
            markdown: Raw markdown content
            
        Returns:
            Dictionary with parsed structure (headings, links, etc.)
        """
        result = {
            'headings': [],
            'links': [],
            'images': [],
            'code_blocks': [],
            'toc_markers': [],
            'tosp_markers': [],
            'mentions': [],
            'work_items': [],
        }
        
        lines = markdown.split('\n')
        
        for i, line in enumerate(lines):
            # Parse headings
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if heading_match:
                result['headings'].append({
                    'level': len(heading_match.group(1)),
                    'text': heading_match.group(2),
                    'line': i + 1
                })
            
            # Parse TOC/TOSP markers
            if '[[_TOC_]]' in line:
                result['toc_markers'].append({'line': i + 1})
            if '[[_TOSP_]]' in line:
                result['tosp_markers'].append({'line': i + 1})
            
            # Parse mentions (@<name>)
            mentions = re.findall(r'@<([^>]+)>', line)
            for mention in mentions:
                result['mentions'].append({'name': mention, 'line': i + 1})
            
            # Parse work items (#123456)
            work_items = re.findall(r'#(\d{2,})', line)
            for wi in work_items:
                result['work_items'].append({'id': wi, 'line': i + 1})
            
            # Parse links
            links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', line)
            for text, url in links:
                result['links'].append({'text': text, 'url': url, 'line': i + 1})
            
            # Parse images
            images = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', line)
            for alt, src in images:
                result['images'].append({'alt': alt, 'src': src, 'line': i + 1})
        
        # Parse code blocks
        code_block_pattern = re.compile(r'```(\w*)\n(.*?)```', re.DOTALL)
        for match in code_block_pattern.finditer(markdown):
            result['code_blocks'].append({
                'language': match.group(1) or 'plain',
                'content': match.group(2).strip()
            })
        
        return result
    
    def validate_toc_structure(self, headings: List[Dict]) -> Dict[str, Any]:
        """Validate TOC structure from headings.
        
        Args:
            headings: List of heading dictionaries
            
        Returns:
            Validation result with structure analysis
        """
        if not headings:
            return {'valid': True, 'issues': [], 'structure': []}
        
        issues = []
        structure = []
        prev_level = 0
        
        for h in headings:
            level = h['level']
            text = h['text']
            
            # Check for level jumps (e.g., h1 -> h3)
            if prev_level > 0 and level > prev_level + 1:
                issues.append(f"Level jump from h{prev_level} to h{level} at line {h['line']}")
            
            structure.append({
                'level': level,
                'text': text,
                'indent': '  ' * (level - 1) + f"- {text}"
            })
            prev_level = level
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'structure': structure
        }
    
    def generate_test_markdown(self, features: List[str] = None) -> str:
        """Generate test markdown content with specified features.
        
        Args:
            features: List of features to include (headings, toc, mentions, etc.)
            
        Returns:
            Generated markdown content
        """
        if features is None:
            features = ['headings', 'toc', 'basic']
        
        content_parts = []
        
        if 'toc' in features:
            content_parts.append('[[_TOC_]]')
            content_parts.append('')
        
        if 'headings' in features:
            content_parts.extend([
                '# Main Title',
                '',
                'Introduction paragraph.',
                '',
                '## Section 1',
                '',
                'Content for section 1.',
                '',
                '### Subsection 1.1',
                '',
                'Details for subsection.',
                '',
                '## Section 2',
                '',
                'Content for section 2.',
                ''
            ])
        
        if 'mentions' in features:
            content_parts.extend([
                '## Team Members',
                '',
                'Assigned to @<John Doe> and @<Jane Smith>.',
                ''
            ])
        
        if 'work_items' in features:
            content_parts.extend([
                '## Related Work Items',
                '',
                'See #12345 and #67890 for details.',
                ''
            ])
        
        if 'code' in features:
            content_parts.extend([
                '## Code Example',
                '',
                '```typescript',
                'const editor = new MilkdownEditor();',
                'editor.create();',
                '```',
                ''
            ])
        
        if 'tosp' in features:
            content_parts.extend([
                '## Sub-Pages',
                '',
                '[[_TOSP_]]',
                ''
            ])
        
        if 'links' in features:
            content_parts.extend([
                '## Resources',
                '',
                '[Azure DevOps](https://dev.azure.com)',
                '[Documentation](./docs/readme.md)',
                ''
            ])
        
        if 'images' in features:
            content_parts.extend([
                '## Screenshots',
                '',
                '![Screenshot](./images/screenshot.png)',
                ''
            ])
        
        if 'table' in features:
            content_parts.extend([
                '## Data Table',
                '',
                '| Column 1 | Column 2 | Column 3 |',
                '|----------|----------|----------|',
                '| Data 1   | Data 2   | Data 3   |',
                '| Data 4   | Data 5   | Data 6   |',
                ''
            ])
        
        return '\n'.join(content_parts)
    
    def compare_markdown(self, expected: str, actual: str) -> Dict[str, Any]:
        """Compare two markdown strings and report differences.
        
        Args:
            expected: Expected markdown content
            actual: Actual markdown content
            
        Returns:
            Comparison result with differences
        """
        expected_lines = expected.strip().split('\n')
        actual_lines = actual.strip().split('\n')
        
        differences = []
        
        max_lines = max(len(expected_lines), len(actual_lines))
        
        for i in range(max_lines):
            exp = expected_lines[i] if i < len(expected_lines) else '<missing>'
            act = actual_lines[i] if i < len(actual_lines) else '<missing>'
            
            if exp != act:
                differences.append({
                    'line': i + 1,
                    'expected': exp,
                    'actual': act
                })
        
        return {
            'match': len(differences) == 0,
            'differences': differences,
            'expected_lines': len(expected_lines),
            'actual_lines': len(actual_lines)
        }
