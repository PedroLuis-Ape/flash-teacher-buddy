export type ClassroomMembershipStatus =
  | 'invited'
  | 'requested'
  | 'active'
  | 'rejected'
  | 'cancelled'
  | 'removed'
  | 'left'
  | 'expired';

export type ClassroomMembershipAction =
  | 'request_join'
  | 'invite'
  | 'approve_request'
  | 'reject_request'
  | 'cancel_request'
  | 'accept_invite'
  | 'reject_invite'
  | 'cancel_invite'
  | 'add_direct'
  | 'remove_member'
  | 'leave';

export function isActiveMembership(status?: string | null, legacyActive?: boolean | null) {
  return status ? status === 'active' : legacyActive === true;
}

export function isPendingMembership(status?: string | null) {
  return status === 'requested' || status === 'invited';
}

export function canTransitionMembership({
  status,
  action,
  isOwner,
  isSubject,
}: {
  status?: string | null;
  action: ClassroomMembershipAction;
  isOwner: boolean;
  isSubject: boolean;
}) {
  if (['invite', 'approve_request', 'reject_request', 'cancel_invite', 'add_direct', 'remove_member'].includes(action)) {
    return isOwner;
  }
  if (['request_join', 'cancel_request', 'accept_invite', 'reject_invite', 'leave'].includes(action)) {
    return isSubject;
  }
  return false;
}
