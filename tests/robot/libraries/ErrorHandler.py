"""
Error Handler Library for Robot Framework Tests

Provides retry logic, audit logging, and error handling capabilities
for the ADO Wiki Editor extension tests.
"""

import logging
import time
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv


class ErrorHandler:
    """Library for error handling and retry logic in Robot Framework tests."""
    
    ROBOT_LIBRARY_SCOPE = 'GLOBAL'
    
    def __init__(self, max_retries: int = 3, retry_delay: int = 2):
        """Initialize the error handler.
        
        Args:
            max_retries: Maximum number of retry attempts
            retry_delay: Delay in seconds between retries
        """
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.audit_log: List[Dict] = []
        self.logger = logging.getLogger('ErrorHandler')
        self._auto_load_dotenv()
    
    def _auto_load_dotenv(self):
        """Automatically load .env file from tests root (parent directory)."""
        try:
            # .env is in tests/ directory, one level up from robot/
            current_dir = Path(__file__).parent.parent.parent
            dotenv_path = current_dir / '.env'
            
            if dotenv_path.exists():
                load_dotenv(dotenv_path, override=True)
                self.logger.info(f"Auto-loaded environment variables from {dotenv_path}")
            else:
                self.logger.warning(
                    f".env file not found at {dotenv_path}. "
                    "Environment variables should be set through other means."
                )
        except Exception as e:
            self.logger.warning(f"Could not auto-load .env file: {e}")
    
    def execute_with_retry(self, keyword_name: str, *args, **kwargs) -> Any:
        """Execute a Robot Framework keyword with retry logic.
        
        Args:
            keyword_name: Name of the keyword to execute
            *args: Positional arguments for the keyword
            **kwargs: Keyword arguments for the keyword
            
        Returns:
            Result of the keyword execution
            
        Raises:
            Exception: If all retry attempts fail
        """
        from robot.libraries.BuiltIn import BuiltIn
        
        builtin = BuiltIn()
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                self.logger.info(f"Attempt {attempt + 1}/{self.max_retries} for keyword '{keyword_name}'")
                result = builtin.run_keyword(keyword_name, *args, **kwargs)
                self.logger.info(f"Successfully executed '{keyword_name}' on attempt {attempt + 1}")
                return result
            except Exception as e:
                last_exception = e
                self.logger.warning(f"Attempt {attempt + 1} failed for '{keyword_name}': {str(e)}")
                
                if attempt < self.max_retries - 1:
                    self.logger.info(f"Waiting {self.retry_delay} seconds before retry...")
                    time.sleep(self.retry_delay)
                else:
                    self.logger.error(f"All {self.max_retries} attempts failed for '{keyword_name}'")
        
        raise last_exception
    
    def log_audit_entry(self, action: str, status: str, details: dict = None):
        """Log an action to the audit trail.
        
        Args:
            action: Description of the action performed
            status: Status of the action (SUCCESS, FAILURE, etc.)
            details: Optional dictionary with additional details
        """
        entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'status': status,
            'details': details or {}
        }
        self.audit_log.append(entry)
        self.logger.info(f"Audit: {action} - {status}")
    
    def save_audit_log(self, filepath: str = None):
        """Save the audit log to a JSON file.
        
        Args:
            filepath: Path to save the audit log (default: logs/audit_log_<timestamp>.json)
        """
        if filepath is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            logs_dir = Path(__file__).parent.parent / 'logs'
            logs_dir.mkdir(exist_ok=True)
            filepath = logs_dir / f'audit_log_{timestamp}.json'
        
        with open(filepath, 'w') as f:
            json.dump(self.audit_log, f, indent=2)
        
        self.logger.info(f"Audit log saved to {filepath}")
    
    def clear_audit_log(self):
        """Clear the audit log."""
        self.audit_log = []
        self.logger.info("Audit log cleared")
    
    def get_audit_log(self) -> list:
        """Get the current audit log.
        
        Returns:
            List of audit log entries
        """
        return self.audit_log.copy()
    
    def handle_error(self, error_message: str, take_screenshot: bool = True):
        """Handle an error with logging and optional screenshot.
        
        Args:
            error_message: Error message to log
            take_screenshot: Whether to attempt taking a screenshot
        """
        from robot.libraries.BuiltIn import BuiltIn
        
        builtin = BuiltIn()
        self.logger.error(error_message)
        self.log_audit_entry('Error', 'FAILURE', {'message': error_message})
        
        if take_screenshot:
            try:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                builtin.run_keyword('Take Screenshot', f'error_{timestamp}')
            except Exception as e:
                self.logger.warning(f"Could not take screenshot: {e}")
    
    def load_dotenv_file(self, dotenv_path: str = None) -> bool:
        """Load environment variables from .env file.
        
        Args:
            dotenv_path: Path to .env file (default: searches parent directories)
            
        Returns:
            True if .env file was loaded successfully, False otherwise
        """
        if dotenv_path is None:
            current_dir = Path(__file__).parent.parent
            dotenv_path = current_dir / '.env'
        
        if Path(dotenv_path).exists():
            load_dotenv(dotenv_path, override=True)
            self.logger.info(f"Loaded environment variables from {dotenv_path}")
            return True
        else:
            self.logger.warning(f".env file not found at {dotenv_path}")
            return False
