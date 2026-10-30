fn main() {
    println!("cargo:rustc-link-lib=comctl32");
    println!("cargo:rustc-link-lib=shell32");
    println!("cargo:rustc-link-lib=ole32");
    tauri_build::build();
}
