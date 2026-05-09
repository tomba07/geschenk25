export const FRIEND_REQUESTS_UPDATED_EVENT = 'geschenk:friend-requests-updated';

export function notifyFriendRequestsUpdated() {
  window.dispatchEvent(new Event(FRIEND_REQUESTS_UPDATED_EVENT));
}
