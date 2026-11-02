import type { Language } from "./vault";
import type { UpdateStage } from "./updater";

/**
 * A human-readable label for a stage of the verified update.
 *
 * The progress bar used to animate on a timer, so it claimed a download was
 * running even while the app was doing nothing. Showing the real stage
 * keeps the interface honest about what the app is doing.
 */
export function stageLabel(stage: UpdateStage, lang: Language = "en"): string {
  if (lang === "bn") {
    switch (stage) {
      case "snapshot":
        return "সুরক্ষিত ব্যাকআপ তৈরি হচ্ছে...";
      case "resolving":
        return "রিলিজের ফাইল তালিকা পাওয়া যাচ্ছে...";
      case "manifest":
        return "চেকসাম ম্যানিফেস্ট পড়া হচ্ছে...";
      case "downloading":
        return "আপডেট প্যাকেজ ডাউনলোড হচ্ছে...";
      case "verifying":
        return "চেকসাম যাচাই করা হচ্ছে...";
      case "done":
        return "যাচাই সম্পন্ন — ইনস্টলার খোলা হচ্ছে...";
      case "failed":
        return "আপডেট ব্যর্থ";
      default:
        return "অপেক্ষা করছে...";
    }
  }

  switch (stage) {
    case "snapshot":
      return "Creating a safety snapshot...";
    case "resolving":
      return "Resolving the release files...";
    case "manifest":
      return "Reading the checksum manifest...";
    case "downloading":
      return "Downloading the update package...";
    case "verifying":
      return "Verifying the checksum...";
    case "done":
      return "Verified — opening the installer...";
    case "failed":
      return "The update failed";
    default:
      return "Waiting...";
  }
}
