import { describe, expect, it } from 'vitest';
import {
  canTransitionMembership,
  isActiveMembership,
  isPendingMembership,
} from './membershipState';

describe('classroom membership state helpers', () => {
  it('keeps active as the canonical status and supports legacy ativo reads', () => {
    expect(isActiveMembership('active', false)).toBe(true);
    expect(isActiveMembership('removed', true)).toBe(false);
    expect(isActiveMembership(null, true)).toBe(true);
    expect(isActiveMembership(null, false)).toBe(false);
  });

  it('recognizes only request and invitation as pending', () => {
    expect(isPendingMembership('requested')).toBe(true);
    expect(isPendingMembership('invited')).toBe(true);
    expect(isPendingMembership('active')).toBe(false);
    expect(isPendingMembership('removed')).toBe(false);
  });

  it('keeps owner and subject actions separated', () => {
    expect(canTransitionMembership({ status: 'requested', action: 'approve_request', isOwner: true, isSubject: false })).toBe(true);
    expect(canTransitionMembership({ status: 'requested', action: 'approve_request', isOwner: false, isSubject: true })).toBe(false);
    expect(canTransitionMembership({ status: 'active', action: 'leave', isOwner: false, isSubject: true })).toBe(true);
    expect(canTransitionMembership({ status: 'active', action: 'leave', isOwner: true, isSubject: false })).toBe(false);
  });
});
