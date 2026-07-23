export const PROFILE_UPDATED_EVENT = "zuraas:profile-updated";

export type ProfileUpdatedDetail = {
  email: string;
  displayName: string;
  contactEmail: string;
  avatarUrl: string | null;
  coverUrl: string | null;
};

export function emitProfileUpdated(detail: ProfileUpdatedDetail) {
  window.dispatchEvent(
    new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail }),
  );
}
