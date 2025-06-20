"""
Text processing and filtering utilities
"""

import re
from typing import List
from config import HALLUCINATION_PHRASES


class TextProcessor:
    """Handles text processing and filtering"""
    
    @staticmethod
    def split_sentences(text: str) -> List[str]:
        """Split sentences"""
        return re.split(r"(?<=[.!?\u3002])\s+", text)

    @staticmethod
    def is_hallucination(text: str) -> bool:
        """Filter hallucination text"""
        return text.lower().strip() in HALLUCINATION_PHRASES

    @staticmethod
    def remove_duplicate_text(new_text: str, last_text: str) -> str:
        """Remove duplicate text from new transcription"""
        if not last_text or not new_text:
            return new_text
        
        # Split into words
        new_words = new_text.split()
        last_words = last_text.split()
        
        # Find the longest common suffix in last_text and prefix in new_text
        max_overlap = min(len(new_words), len(last_words))
        overlap_len = 0
        
        for i in range(1, max_overlap + 1):
            if last_words[-i:] == new_words[:i]:
                overlap_len = i
        
        # Return only the new part
        if overlap_len > 0:
            result = " ".join(new_words[overlap_len:])
            print(f"🔄 Removed {overlap_len} overlapping words: '{' '.join(new_words[:overlap_len])}'")
            return result
        
        return new_text 
