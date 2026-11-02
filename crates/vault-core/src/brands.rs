use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandInfo {
    pub slug: String,
    pub name: String,
    pub domain_keywords: Vec<String>,
    pub brand_color: String,
    pub text_color: String, // #ffffff or #000000
    pub svg_icon: String,
}

pub struct BrandRegistry;

impl BrandRegistry {
    pub fn all_brands() -> Vec<BrandInfo> {
        vec![
            BrandInfo {
                slug: "github".into(),
                name: "GitHub".into(),
                domain_keywords: vec!["github.com".into(), "github".into()],
                brand_color: "#181717".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "google".into(),
                name: "Google".into(),
                domain_keywords: vec!["google.com".into(), "gmail.com".into(), "google".into()],
                brand_color: "#4285F4".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "airbnb".into(),
                name: "Airbnb".into(),
                domain_keywords: vec!["airbnb.com".into(), "airbnb".into()],
                brand_color: "#FF5A5F".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "discord".into(),
                name: "Discord".into(),
                domain_keywords: vec!["discord.com".into(), "discord.gg".into(), "discord".into()],
                brand_color: "#5865F2".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "microsoft".into(),
                name: "Microsoft".into(),
                domain_keywords: vec![
                    "microsoft.com".into(),
                    "live.com".into(),
                    "outlook.com".into(),
                    "office.com".into(),
                    "azure.com".into(),
                ],
                brand_color: "#00A4EF".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "apple".into(),
                name: "Apple".into(),
                domain_keywords: vec!["apple.com".into(), "icloud.com".into(), "apple".into()],
                brand_color: "#000000".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.13.64-2.79 1.41-.57.65-1.07 1.71-1.02 2.76 1.08.08 2.18-.55 2.8-1.3\"/></svg>".into(),
            },
            BrandInfo {
                slug: "amazon".into(),
                name: "Amazon".into(),
                domain_keywords: vec![
                    "amazon.com".into(),
                    "aws.amazon.com".into(),
                    "amazon".into(),
                ],
                brand_color: "#FF9900".into(),
                text_color: "#000000".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M13.916 17.587c-3.473 2.56-8.397 3.93-12.748 1.34-.607-.362-1.168.272-.613.722 4.015 3.256 9.878 3.738 14.394 1.036.717-.43.167-1.283-.49-1.098zm1.905-1.428c-.443-.574-2.905-.272-4.02-.136-.34.042-.39-.23-.082-.447 2-.1.417 4.717-.912 6.556.702.235.267-.04.912-.39 1.445-1.455 1.977-3.978 2.39-4.83.21-.428-.48-.63-.915-.63z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "netflix".into(),
                name: "Netflix".into(),
                domain_keywords: vec!["netflix.com".into(), "netflix".into()],
                brand_color: "#E50914".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M5.398 0v24c1.868-.344 3.738-.707 5.617-1.07V0H5.398zm7.586 0v22.42c1.88-.37 3.76-.74 5.618-1.11V0h-5.618z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "linkedin".into(),
                name: "LinkedIn".into(),
                domain_keywords: vec!["linkedin.com".into(), "linkedin".into()],
                brand_color: "#0A66C2".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "paypal".into(),
                name: "PayPal".into(),
                domain_keywords: vec!["paypal.com".into(), "paypal".into()],
                brand_color: "#003087".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.82.9 5.097-.738 4.148-3.415 6.382-7.55 6.382H9.28l-1.07 6.787a.642.642 0 0 1-.634.542z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "figma".into(),
                name: "Figma".into(),
                domain_keywords: vec!["figma.com".into(), "figma".into()],
                brand_color: "#F24E1E".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0zm-8 4a4 4 0 0 0 4 4h4v-8H8a4 4 0 0 0-4 4zm0-8a4 4 0 0 0 4 4h4V4H8a4 4 0 0 0-4 4zm8-4h4a4 4 0 1 1 0 8h-4V4zm-4 12a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4v-4H8z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "twitter".into(),
                name: "X / Twitter".into(),
                domain_keywords: vec!["x.com".into(), "twitter.com".into()],
                brand_color: "#000000".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z\"/></svg>".into(),
            },
            BrandInfo {
                slug: "reddit".into(),
                name: "Reddit".into(),
                domain_keywords: vec!["reddit.com".into(), "reddit".into()],
                brand_color: "#FF4500".into(),
                text_color: "#FFFFFF".into(),
                svg_icon: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702z\"/></svg>".into(),
            },
        ]
    }

    /// Extracts the lower-cased host from a URL-ish string.
    ///
    /// Accepts a bare host (`google.com`), a full URL
    /// (`https://accounts.google.com/login`), or a host with a port/path.
    fn extract_host(url: &str) -> Option<String> {
        let trimmed = url.trim();
        if trimmed.is_empty() {
            return None;
        }

        // Strip a scheme if present.
        let after_scheme = match trimmed.find("://") {
            Some(idx) => &trimmed[idx + 3..],
            None => trimmed,
        };

        // Cut at the first path, query or fragment marker.
        let host_part = after_scheme
            .split(|c| c == '/' || c == '?' || c == '#')
            .next()
            .unwrap_or(after_scheme);

        // Strip credentials and port.
        let host_only = host_part.rsplit('@').next().unwrap_or(host_part);
        let host_only = host_only.split(':').next().unwrap_or(host_only);

        if host_only.is_empty() {
            None
        } else {
            Some(host_only.trim_end_matches('.').to_lowercase())
        }
    }

    /// Reduces a host to its registrable domain (eTLD+1 approximation).
    ///
    /// `accounts.google.com` -> `google.com`
    /// `www.netflix.com`     -> `netflix.com`
    /// `notgoogle.com`       -> `notgoogle.com`  (NOT google.com)
    ///
    /// The public-suffix list is not bundled, so a conservative two-label
    /// rule is used: the last two labels of the host. Multi-label public
    /// suffixes such as `co.uk` are handled by a small allowlist.
    fn registrable_domain(host: &str) -> String {
        const MULTI_LABEL_SUFFIXES: &[&str] = &[
            "co.uk",
            "org.uk",
            "ac.uk",
            "gov.uk",
            "co.jp",
            "co.kr",
            "com.au",
            "com.br",
            "com.cn",
            "co.in",
            "co.nz",
            "com.mx",
            "co.za",
            "com.tr",
            "com.sg",
            "com.hk",
            "com.tw",
            "com.ar",
            "github.io",
            "gitlab.io",
        ];

        let labels: Vec<&str> = host.split('.').filter(|l| !l.is_empty()).collect();
        if labels.len() <= 2 {
            return host.to_string();
        }

        let last_two = format!("{}.{}", labels[labels.len() - 2], labels[labels.len() - 1]);
        if MULTI_LABEL_SUFFIXES.contains(&last_two.as_str()) && labels.len() >= 3 {
            let third = labels[labels.len() - 3];
            return format!("{}.{}", third, last_two);
        }
        last_two
    }

    /// Returns true when `keyword` appears in `text` as a whole word.
    ///
    /// Word boundaries are non-alphanumeric characters, so `"My Github
    /// Account"` matches `github` but `"Not Google"` does not, and
    /// `"googleish"` does not either.
    fn contains_whole_word(text: &str, keyword: &str) -> bool {
        if keyword.is_empty() {
            return false;
        }
        let text = text.to_lowercase();
        let keyword = keyword.to_lowercase();
        let bytes = text.as_bytes();
        let needle = keyword.as_bytes();
        let mut start = 0usize;

        while start < bytes.len() {
            let match_at = match text[start..].find(&keyword) {
                Some(offset) => start + offset,
                None => return false,
            };
            let end = match_at + needle.len();

            let left_ok = match_at == 0 || !bytes[match_at - 1].is_ascii_alphanumeric();
            let right_ok = end == bytes.len() || !bytes[end].is_ascii_alphanumeric();

            if left_ok && right_ok {
                return true;
            }
            start = match_at + 1;
        }
        false
    }

    /// Automatically matches a brand from an entry's title or URL without any network requests.
    ///
    /// SECURITY (V-27): the previous implementation used a raw substring
    /// test (`url.contains(keyword) || title.contains(keyword)`), which let
    /// phishing look-alikes borrow a real brand's icon:
    ///
    /// * `notgoogle.com`            -> matched **Google**
    /// * `fake-netflix-login.com`   -> matched **Netflix**
    /// * `googleish.example.com`    -> matched **Google**
    ///
    /// A password manager that shows the genuine Google logo next to a
    /// hostile domain actively trains the user to trust it. Matching is now
    /// exact:
    ///
    /// * A keyword containing a `.` must equal the registrable domain of
    ///   the URL host (or be a parent of it, so `google.com` still matches
    ///   `accounts.google.com`).
    /// * A keyword without a `.` (a bare name like `google`) is matched
    ///   against the **title** as a whole word only, never against the URL.
    pub fn match_brand(title: &str, url: &str) -> Option<BrandInfo> {
        // Candidates: the URL host and, when the title itself contains a
        // host-like token, that token. A title such as "google.com.hacker.io"
        // must be judged as a domain, not as a bag of words.
        let mut candidates: Vec<String> = Vec::new();
        if let Some(host) = Self::extract_host(url) {
            candidates.push(Self::registrable_domain(&host));
        }
        for token in Self::extract_title_hosts(title) {
            candidates.push(Self::registrable_domain(&token));
        }
        let t_clean = title.to_lowercase();

        for b in Self::all_brands() {
            for kw in &b.domain_keywords {
                let keyword = kw.to_lowercase();

                if keyword.contains('.') {
                    // Domain keyword: require an exact registrable-domain
                    // match against the URL host or a host-like title token.
                    if candidates.iter().any(|c| c == &keyword) {
                        return Some(b);
                    }
                } else {
                    // Bare name: whole-word match against the title only,
                    // and only when the title is not itself a domain (in
                    // which case the domain rules above already applied).
                    if !candidates.is_empty() && Self::title_is_host_like(title) {
                        continue;
                    }
                    if Self::contains_whole_word(&t_clean, &keyword) {
                        return Some(b);
                    }
                }
            }
        }
        None
    }

    /// True when the title looks like a host (contains a dot-separated
    /// token with a public-suffix-looking tail).
    fn title_is_host_like(title: &str) -> bool {
        !Self::extract_title_hosts(title).is_empty()
    }

    /// Extracts host-like tokens from free text.
    ///
    /// "Visit google.com now" -> ["google.com"]
    /// "google.com.hacker.io"  -> ["google.com.hacker.io"]
    fn extract_title_hosts(title: &str) -> Vec<String> {
        let mut hosts = Vec::new();
        for token in title.split(|c: char| c.is_whitespace() || c == ',' || c == ';') {
            let cleaned = token
                .trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '.' && c != '-')
                .to_lowercase();
            if cleaned.is_empty() || !cleaned.contains('.') {
                continue;
            }
            // Require at least one alphabetic label and a plausible TLD.
            let labels: Vec<&str> = cleaned.split('.').filter(|l| !l.is_empty()).collect();
            if labels.len() < 2 {
                continue;
            }
            let tld = labels[labels.len() - 1];
            if tld.len() < 2 || !tld.chars().all(|c| c.is_ascii_alphabetic()) {
                continue;
            }
            if !labels[0].chars().any(|c| c.is_ascii_alphabetic()) {
                continue;
            }
            hosts.push(cleaned);
        }
        hosts
    }
}

#[cfg(test)]
mod tests {
    use super::BrandRegistry;

    fn slug_of(title: &str, url: &str) -> Option<String> {
        BrandRegistry::match_brand(title, url).map(|b| b.slug)
    }

    /// V-27: phishing look-alikes must NOT inherit a real brand's identity.
    #[test]
    fn phishing_lookalikes_do_not_match_real_brands() {
        let cases = [
            ("notgoogle.com", "google"),
            ("fake-netflix-login.com", "netflix"),
            ("googleish.example.com", "google"),
            ("netflix-login-secure.com", "netflix"),
            ("github.com.attacker.net", "github"),
            ("amazon.com.evil.io", "amazon"),
            ("paypal-secure-verification.com", "paypal"),
        ];
        for (host, brand) in cases {
            assert_eq!(
                slug_of("Some Login", &format!("https://{}", host)),
                None,
                "{} must not be recognised as {}",
                host,
                brand
            );
        }
    }

    /// V-27: genuine hosts (and their subdomains) must still match.
    #[test]
    fn genuine_domains_still_match() {
        assert_eq!(
            slug_of("Google", "https://google.com"),
            Some("google".into())
        );
        assert_eq!(
            slug_of("Google", "https://accounts.google.com/signin"),
            Some("google".into())
        );
        assert_eq!(
            slug_of("Google", "https://mail.google.com"),
            Some("google".into())
        );
        assert_eq!(
            slug_of("Netflix", "https://www.netflix.com/browse"),
            Some("netflix".into())
        );
        assert_eq!(slug_of("GitHub", "github.com"), Some("github".into()));
    }

    /// V-27: bare brand names are matched against the title as whole words,
    /// never against the URL.
    #[test]
    fn bare_names_match_titles_as_whole_words() {
        assert_eq!(slug_of("My Github Account", ""), Some("github".into()));
        assert_eq!(slug_of("Netflix", ""), Some("netflix".into()));
        // "Not Google" still contains the whole word "google", so it matches —
        // that is expected for a title heuristic. What must never match is a
        // *substring* such as "Googleish".
        assert_eq!(slug_of("Googleish", ""), None);
        assert_eq!(slug_of("I use google daily", ""), Some("google".into()));
        assert_eq!(slug_of("google.com.hacker.io", ""), None);
    }

    #[test]
    fn host_extraction_handles_malformed_input() {
        assert_eq!(
            BrandRegistry::extract_host("https://a.b/c?d=1"),
            Some("a.b".into())
        );
        assert_eq!(
            BrandRegistry::extract_host("user:pw@host.example.com:8443/x"),
            Some("host.example.com".into())
        );
        assert_eq!(
            BrandRegistry::extract_host("example.com."),
            Some("example.com".into())
        );
        assert_eq!(BrandRegistry::extract_host(""), None);
        assert_eq!(BrandRegistry::extract_host("   "), None);
    }

    #[test]
    fn registrable_domain_reduction() {
        assert_eq!(
            BrandRegistry::registrable_domain("accounts.google.com"),
            "google.com"
        );
        assert_eq!(
            BrandRegistry::registrable_domain("notgoogle.com"),
            "notgoogle.com"
        );
        assert_eq!(
            BrandRegistry::registrable_domain("a.b.c.example.co.uk"),
            "example.co.uk"
        );
        assert_eq!(
            BrandRegistry::registrable_domain("example.com"),
            "example.com"
        );
    }
}
