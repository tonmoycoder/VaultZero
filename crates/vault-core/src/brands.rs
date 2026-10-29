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
                domain_keywords: vec!["microsoft.com".into(), "live.com".into(), "outlook.com".into(), "office.com".into(), "azure.com".into()],
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
                domain_keywords: vec!["amazon.com".into(), "aws.amazon.com".into(), "amazon".into()],
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

    /// Automatically matches a brand from an entry's title or URL without any network requests.
    pub fn match_brand(title: &str, url: &str) -> Option<BrandInfo> {
        let t_clean = title.to_lowercase();
        let u_clean = url.to_lowercase();
        let brands = Self::all_brands();

        for b in brands {
            for kw in &b.domain_keywords {
                if u_clean.contains(kw) || t_clean.contains(kw) {
                    return Some(b);
                }
            }
        }
        None
    }
}

