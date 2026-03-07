import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { formatLicenseHint, normalizeLicenseKey, verifyLicenseKey, type LicenseStatus } from '@/lib/license/license';

type LicenseState = {
  licenseKey: string;
  status: LicenseStatus;
  setLicenseKey: (key: string) => void;
  activate: (key: string) => LicenseStatus;
  clear: () => void;
  refresh: () => void;
  getHint: () => string;
};

function computeStatus(licenseKey: string): LicenseStatus {
  return verifyLicenseKey(licenseKey);
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      licenseKey: '',
      status: { valid: false, reason: '未激活' },
      setLicenseKey: (key) => {
        set({ licenseKey: key });
      },
      activate: (key) => {
        const normalized = normalizeLicenseKey(key);
        const status = computeStatus(normalized);
        if (status.valid) {
          set({ licenseKey: normalized, status });
        } else {
          set({ status });
        }
        return status;
      },
      clear: () => {
        set({ licenseKey: '', status: { valid: false, reason: '未激活' } });
      },
      refresh: () => {
        const key = get().licenseKey;
        set({ status: computeStatus(key) });
      },
      getHint: () => {
        const s = get().status;
        return s.valid ? formatLicenseHint(s.payload) : '';
      },
    }),
    {
      name: 'manguo-license',
      version: 1,
      partialize: (state) => ({ licenseKey: state.licenseKey }),
      onRehydrateStorage: () => (state) => {
        try {
          state?.refresh?.();
        } catch {
          // ignore
        }
      },
    }
  )
);

