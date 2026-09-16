export interface SavedProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  bio: string;
  createdAt: number;
}

export const DEFAULT_PROFILE_ID = 'profile_default';

/**
 * Loads all saved profiles from storage, performing one-time migration from single profile keys if needed.
 */
export async function loadSavedProfiles(): Promise<{ profiles: SavedProfile[]; activeId: string }> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({
        profiles: [
          {
            id: DEFAULT_PROFILE_ID,
            name: 'Personal Profile',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            company: '',
            jobTitle: '',
            bio: '',
            createdAt: Date.now()
          }
        ],
        activeId: DEFAULT_PROFILE_ID
      });
      return;
    }

    chrome.storage.local.get([
      'savedProfiles',
      'activeProfileId',
      'profileFirstName',
      'profileLastName',
      'profileEmail',
      'profilePhone',
      'profileCompany',
      'profileJobTitle',
      'profileBio'
    ], (result) => {
      let profiles: SavedProfile[] = Array.isArray(result.savedProfiles) ? result.savedProfiles : [];
      let activeId = typeof result.activeProfileId === 'string' ? result.activeProfileId : '';

      // Migration from legacy single profile
      if (profiles.length === 0) {
        const legacyProfile: SavedProfile = {
          id: DEFAULT_PROFILE_ID,
          name: 'Personal Profile',
          firstName: typeof result.profileFirstName === 'string' ? result.profileFirstName : '',
          lastName: typeof result.profileLastName === 'string' ? result.profileLastName : '',
          email: typeof result.profileEmail === 'string' ? result.profileEmail : '',
          phone: typeof result.profilePhone === 'string' ? result.profilePhone : '',
          company: typeof result.profileCompany === 'string' ? result.profileCompany : '',
          jobTitle: typeof result.profileJobTitle === 'string' ? result.profileJobTitle : '',
          bio: typeof result.profileBio === 'string' ? result.profileBio : '',
          createdAt: Date.now()
        };
        profiles = [legacyProfile];
        activeId = DEFAULT_PROFILE_ID;
        chrome.storage.local.set({ savedProfiles: profiles, activeProfileId: activeId });
      } else if (!activeId || !profiles.some(p => p.id === activeId)) {
        activeId = profiles[0].id;
        chrome.storage.local.set({ activeProfileId: activeId });
      }

      resolve({ profiles, activeId });
    });
  });
}

/**
 * Synchronizes the active profile's fields into legacy storage keys so background.ts and scraper.ts immediately see them.
 */
export function syncActiveProfileToStorage(profile: SavedProfile): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({
    activeProfileId: profile.id,
    profileFirstName: profile.firstName,
    profileLastName: profile.lastName,
    profileEmail: profile.email,
    profilePhone: profile.phone,
    profileCompany: profile.company,
    profileJobTitle: profile.jobTitle,
    profileBio: profile.bio
  });
}
