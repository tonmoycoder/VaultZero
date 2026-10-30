fn main() {
    #[cfg(not(all(windows, target_env = "gnu")))]
    tauri_build::build();
}
