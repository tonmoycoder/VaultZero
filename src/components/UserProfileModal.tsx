import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Camera, Check, Trash, User, Sparkle, UploadSimple } from "@phosphor-icons/react";
import { Modal, Avatar } from "./ui";
import { t, type Language } from "../lib/vault";

export interface UserProfileData {
  name: string;
  role: string;
  avatar: string | null;
}

export function getUserProfile(): UserProfileData {
  if (typeof window === "undefined") {
    return { name: "Vault Owner", role: "Vault Owner", avatar: null };
  }
  return {
    name: localStorage.getItem("vaultzero_username") || "Vault Owner",
    role: localStorage.getItem("vaultzero_user_role") || "Vault Owner",
    avatar: localStorage.getItem("vaultzero_user_avatar") || null,
  };
}

export default function UserProfileModal({
  onClose,
  onNotify,
  onProfileUpdated,
  lang = "en",
}: {
  onClose: () => void;
  onNotify: (msg: string) => void;
  onProfileUpdated?: (data: UserProfileData) => void;
  lang?: Language;
}) {
  const current = getUserProfile();
  const [name, setName] = useState(current.name);
  const [role, setRole] = useState(current.role);
  const [avatar, setAvatar] = useState<string | null>(current.avatar);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onNotify(lang === "bn" ? "অনুগ্রহ করে একটি ছবি নির্বাচন করুন" : "Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 160x160 square canvas for crisp high-DPI
        const canvas = document.createElement("canvas");
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Cover-fit cropping
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const dataUrl = canvas.toDataURL("image/webp", 0.9);
        setAvatar(dataUrl);
        onNotify(lang === "bn" ? "প্রোফাইল ছবি নির্বাচন করা হয়েছে" : "Photo chosen, click Save to apply");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onNotify(lang === "bn" ? "প্রোফাইল ছবি সরানো হয়েছে" : "Profile photo removed");
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const trimmedName = name.trim() || "Vault Owner";
    const trimmedRole = role.trim() || "Vault Owner";

    localStorage.setItem("vaultzero_username", trimmedName);
    localStorage.setItem("vaultzero_user_role", trimmedRole);
    if (avatar) {
      localStorage.setItem("vaultzero_user_avatar", avatar);
    } else {
      localStorage.removeItem("vaultzero_user_avatar");
    }

    // Broadcast update across window listeners
    window.dispatchEvent(new Event("vaultzero_profile_updated"));

    const updatedData: UserProfileData = {
      name: trimmedName,
      role: trimmedRole,
      avatar,
    };
    onProfileUpdated?.(updatedData);

    onNotify(lang === "bn" ? "✓ প্রোফাইল সফলভাবে আপডেট করা হয়েছে!" : "✓ Profile updated successfully!");
    setSaving(false);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={lang === "bn" ? "প্রোফাইল ও ছবি পরিবর্তন" : "Edit Vault Profile"}
      subtitle={
        lang === "bn"
          ? "আপনার নাম ও প্রোফাইল ছবি সম্পূর্ণ অফলাইনে এই ডিভাইসে সংরক্ষিত থাকে।"
          : "Customize your display name and avatar photo. Stored 100% offline."
      }
      icon={<User size={20} weight="duotone" />}
      width="max-w-[480px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="secondary-button h-10 rounded-full px-4 text-[11px] font-semibold"
          >
            {t(lang, "cancel")}
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={saving}
            className="primary-button flex h-10 items-center gap-1.5 rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
          >
            <Check size={14} weight="bold" />
            {lang === "bn" ? "সংরক্ষণ করুন" : "Save Profile"}
          </button>
        </div>
      }
    >
      <form id="profile-form" onSubmit={handleSave} className="space-y-4 py-1">
        {/* Avatar Preview & Actions */}
        <div className="flex items-center gap-4 rounded-[18px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-3.5">
          <div className="relative">
            <Avatar name={name || "Vault Owner"} size={68} photoUrl={avatar} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-[var(--accent)] text-white shadow-md transition-transform hover:scale-110"
              title={lang === "bn" ? "ছবি পরিবর্তন করুন" : "Change photo"}
            >
              <Camera size={13} weight="bold" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-main">
              {avatar ? (lang === "bn" ? "কাস্টম ছবি সক্রিয়" : "Custom Photo Active") : (lang === "bn" ? "মনোগ্রাম অবতার" : "Monogram Initials")}
            </p>
            <p className="mt-0.5 text-[8.5px] text-muted">
              {lang === "bn" ? "PNG, JPG বা WebP ফরম্যাট (160×160)" : "PNG, JPG or WebP (square auto-crop)"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="secondary-button flex h-7 items-center gap-1 rounded-lg px-2.5 text-[9px] font-semibold"
              >
                <UploadSimple size={12} weight="bold" />
                {lang === "bn" ? "ছবি আপলোড" : "Upload Photo"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash size={12} />
                  {lang === "bn" ? "মুছুন" : "Remove"}
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Display Name Field */}
        <div>
          <label className="mb-1 block text-[9px] font-semibold text-muted">
            {lang === "bn" ? "ডিসপ্লে নাম (Display Name)" : "Display Name"}
          </label>
          <div className="input-shell flex h-[42px] items-center gap-2.5 rounded-[12px] px-3">
            <User size={15} weight="duotone" className="shrink-0 text-faint" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tonmoy Islam"
              className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-main outline-none placeholder:text-faint"
              required
            />
          </div>
        </div>

        {/* Role / Subtitle Field */}
        <div>
          <label className="mb-1 block text-[9px] font-semibold text-muted">
            {lang === "bn" ? "ভূমিকা / সাবটাইটেল (Role / Subtitle)" : "Role / Title (Optional)"}
          </label>
          <div className="input-shell flex h-[42px] items-center gap-2.5 rounded-[12px] px-3">
            <Sparkle size={15} weight="duotone" className="shrink-0 text-faint" />
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Vault Owner / Security Lead"
              className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-main outline-none placeholder:text-faint"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
