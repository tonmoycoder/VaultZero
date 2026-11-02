use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AmbiguousCharacter {
    pub position: usize,
    pub original_char: char,
    pub alternatives: Vec<char>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OcrParsedResult {
    pub title: Option<String>,
    pub url: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub totp_secret: Option<String>,
    pub recovery_codes: Vec<String>,
    pub ambiguous_characters: Vec<AmbiguousCharacter>,
    pub raw_lines: Vec<String>,
}

pub struct OcrSmartParser;

impl OcrSmartParser {
    pub fn parse(raw_text: &str) -> OcrParsedResult {
        let lines: Vec<&str> = raw_text
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();

        let mut url = None;
        let mut email = None;
        let mut username = None;
        let mut password = None;
        let mut totp_secret = None;
        let mut recovery_codes = Vec::new();
        let mut title = None;

        let url_regex = Regex::new(r"(?i)\b(https?://[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)").unwrap();
        let email_regex = Regex::new(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b").unwrap();
        let totp_regex = Regex::new(r"(?i)otpauth://totp/([^?]+)\?.*secret=([A-Z2-7]+)").unwrap();
        let recovery_regex = Regex::new(r"(?i)\b[A-Za-z0-9]{4}-[A-Za-z0-9]{4}(?:-[A-Za-z0-9]{4})*\b").unwrap();

        for line in &lines {
            // Check TOTP otpauth://
            if let Some(caps) = totp_regex.captures(line) {
                if let Some(sec) = caps.get(2) {
                    totp_secret = Some(sec.as_str().to_uppercase());
                }
                continue;
            }

            // Check URL
            if url.is_none() {
                if let Some(m) = url_regex.find(line) {
                    let u = m.as_str();
                    url = Some(if !u.starts_with("http") {
                        format!("https://{}", u)
                    } else {
                        u.to_string()
                    });
                    continue;
                }
            }

            // Check Email
            if email.is_none() {
                if let Some(m) = email_regex.find(line) {
                    email = Some(m.as_str().to_string());
                    continue;
                }
            }

            // Check Recovery Code Pattern
            if let Some(m) = recovery_regex.find(line) {
                recovery_codes.push(m.as_str().to_string());
                continue;
            }

            // Check common key-value prefixes
            let lower = line.to_lowercase();
            if lower.starts_with("user:")
                || lower.starts_with("username:")
                || lower.starts_with("login:")
            {
                let parts: Vec<&str> = line.splitn(2, ':').collect();
                if parts.len() == 2 {
                    username = Some(parts[1].trim().to_string());
                    continue;
                }
            }

            if lower.starts_with("pass:")
                || lower.starts_with("password:")
                || lower.starts_with("pwd:")
            {
                let parts: Vec<&str> = line.splitn(2, ':').collect();
                if parts.len() == 2 {
                    password = Some(parts[1].trim().to_string());
                    continue;
                }
            }

            // Title fallback
            if title.is_none() && !line.contains('@') && !line.contains(':') && line.len() < 30 {
                title = Some(line.to_string());
            }
        }

        // Find ambiguous characters in password if detected
        let mut ambiguous_characters = Vec::new();
        if let Some(ref pwd) = password {
            for (pos, ch) in pwd.chars().enumerate() {
                match ch {
                    '0' => ambiguous_characters.push(AmbiguousCharacter {
                        position: pos,
                        original_char: '0',
                        alternatives: vec!['O', 'o'],
                    }),
                    'O' => ambiguous_characters.push(AmbiguousCharacter {
                        position: pos,
                        original_char: 'O',
                        alternatives: vec!['0', 'o'],
                    }),
                    '1' => ambiguous_characters.push(AmbiguousCharacter {
                        position: pos,
                        original_char: '1',
                        alternatives: vec!['l', 'I', '|'],
                    }),
                    'l' => ambiguous_characters.push(AmbiguousCharacter {
                        position: pos,
                        original_char: 'l',
                        alternatives: vec!['1', 'I', '|'],
                    }),
                    'I' => ambiguous_characters.push(AmbiguousCharacter {
                        position: pos,
                        original_char: 'I',
                        alternatives: vec!['1', 'l', '|'],
                    }),
                    _ => {}
                }
            }
        }

        OcrParsedResult {
            title,
            url,
            email,
            username,
            password,
            totp_secret,
            recovery_codes,
            ambiguous_characters,
            raw_lines: lines.into_iter().map(|s| s.to_string()).collect(),
        }
    }

    /// Resolves an ambiguous character in the password by position
    pub fn replace_character(text: &str, position: usize, replacement: char) -> String {
        let mut chars: Vec<char> = text.chars().collect();
        if position < chars.len() {
            chars[position] = replacement;
        }
        chars.into_iter().collect()
    }
}
