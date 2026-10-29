use zeroize::{Zeroize, ZeroizeOnDrop};

/// A memory buffer that is locked in physical RAM (preventing paging to disk/swap)
/// and automatically zeroized upon drop.
#[derive(Debug)]
pub struct LockedBuffer {
    data: Vec<u8>,
    is_locked: bool,
}

impl LockedBuffer {
    pub fn new(mut data: Vec<u8>) -> Self {
        let is_locked = Self::lock_memory(&mut data);
        Self { data, is_locked }
    }

    pub fn from_slice(slice: &[u8]) -> Self {
        Self::new(slice.to_vec())
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        &mut self.data
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    #[cfg(target_os = "windows")]
    fn lock_memory(data: &mut [u8]) -> bool {
        if data.is_empty() {
            return false;
        }
        unsafe {
            let res = windows_sys::Win32::System::Memory::VirtualLock(
                data.as_mut_ptr() as *mut _,
                data.len(),
            );
            res != 0
        }
    }

    #[cfg(target_os = "windows")]
    fn unlock_memory(data: &mut [u8]) {
        if !data.is_empty() {
            unsafe {
                windows_sys::Win32::System::Memory::VirtualUnlock(
                    data.as_mut_ptr() as *mut _,
                    data.len(),
                );
            }
        }
    }

    #[cfg(target_os = "android")]
    fn lock_memory(data: &mut [u8]) -> bool {
        if data.is_empty() {
            return false;
        }
        unsafe {
            let res = libc::mlock(data.as_ptr() as *const libc::c_void, data.len());
            res == 0
        }
    }

    #[cfg(target_os = "android")]
    fn unlock_memory(data: &mut [u8]) {
        if !data.is_empty() {
            unsafe {
                libc::munlock(data.as_ptr() as *const libc::c_void, data.len());
            }
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "android")))]
    fn lock_memory(_data: &mut [u8]) -> bool {
        // Fallback for non-windows non-android target architectures
        false
    }

    #[cfg(not(any(target_os = "windows", target_os = "android")))]
    fn unlock_memory(_data: &mut [u8]) {
        // Fallback
    }
}

impl Drop for LockedBuffer {
    fn drop(&mut self) {
        self.data.zeroize();
        if self.is_locked {
            Self::unlock_memory(&mut self.data);
            self.is_locked = false;
        }
    }
}

impl Zeroize for LockedBuffer {
    fn zeroize(&mut self) {
        self.data.zeroize();
    }
}

impl ZeroizeOnDrop for LockedBuffer {}
