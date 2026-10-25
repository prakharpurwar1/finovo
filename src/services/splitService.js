/**
 * Finovo Split Expense Service Layer
 * 
 * Manages groups, members, split expenses, shares, settlements, invitations, and activity logging.
 * Integrates with Supabase PostgreSQL and falls back gracefully to localStorage when unconfigured.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { toPaise, fromPaise } from '../utils/currency.js';
import { 
  calculateEqualSplit, 
  calculateUnequalSplit, 
  calculatePercentageSplit, 
  calculateMemberBalances, 
  calculateSimplifiedDebts 
} from '../utils/splitCalculations.js';

// Local storage keys for offline/demo fallback
const STORAGE_PREFIX = 'finovo_split_';

function getLocalStore(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalStore(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error writing to local store ${key}:`, err);
  }
}

/**
 * Generates a safe random invitation token.
 */
function generateInvitationToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const splitService = {
  /**
   * Fetches all groups accessible to the user with calculated net balance summary.
   */
  async fetchUserGroups(userId) {
    if (!userId) return { data: [], error: null };

    if (!isSupabaseConfigured()) {
      const allGroups = getLocalStore(`groups_${userId}`, []);
      return { data: allGroups, error: null };
    }

    try {
      // 1. Fetch groups where user is creator or active member
      const { data: memberGroups, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (memberErr) throw memberErr;

      const groupIds = (memberGroups || []).map(m => m.group_id);

      const { data: groups, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .or(`creator_id.eq.${userId},id.in.(${groupIds.length > 0 ? groupIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false });

      if (groupsErr) throw groupsErr;

      // 2. Fetch member counts and member records for these groups
      const enrichedGroups = await Promise.all((groups || []).map(async (g) => {
        const { data: members } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', g.id)
          .neq('status', 'removed');

        const { data: expenses } = await supabase
          .from('split_expenses')
          .select('*, shares:split_shares(*)')
          .eq('group_id', g.id)
          .eq('status', 'active');

        const { data: settlements } = await supabase
          .from('settlements')
          .select('*')
          .eq('group_id', g.id)
          .eq('status', 'confirmed');

        const { memberBalances, totalShared } = calculateMemberBalances({
          members: members || [],
          expenses: expenses || [],
          settlements: settlements || []
        });

        const userMember = (members || []).find(m => m.user_id === userId);
        const userBalanceRecord = userMember ? memberBalances.find(b => b.memberId === userMember.id) : null;

        return {
          ...g,
          membersCount: (members || []).length,
          members: members || [],
          userMemberId: userMember?.id || null,
          totalShared: totalShared || 0,
          userNetBalance: userBalanceRecord?.netBalance || 0,
          userBalanceStatus: userBalanceRecord?.balanceStatus || 'settled'
        };
      }));

      return { data: enrichedGroups, error: null };
    } catch (err) {
      console.warn('Error fetching user groups from Supabase, falling back to local storage:', err);
      return { data: getLocalStore(`groups_${userId}`, []), error: err.message };
    }
  },

  /**
   * Creates a new group and auto-provisions creator as admin member.
   */
  async createGroup(userId, { name, description = '', icon = 'Users', initialMembers = [] }, userProfile = {}) {
    if (!name || !name.trim()) {
      return { data: null, error: 'Group title is required.' };
    }

    const groupPayload = {
      name: name.trim(),
      description: description.trim(),
      icon: icon || 'Users',
      creator_id: userId,
      is_archived: false
    };

    if (!isSupabaseConfigured()) {
      const groupId = `grp_${Date.now()}`;
      const creatorMemberId = `mem_creator_${Date.now()}`;
      const creatorMember = {
        id: creatorMemberId,
        group_id: groupId,
        user_id: userId,
        name: userProfile.name || 'You (Creator)',
        email: userProfile.email || '',
        role: 'admin',
        status: 'active'
      };

      const otherMembers = initialMembers.map((m, idx) => ({
        id: `mem_${Date.now()}_${idx}`,
        group_id: groupId,
        user_id: null,
        name: m.name || `Member ${idx + 2}`,
        email: m.email || '',
        phone: m.phone || '',
        role: 'member',
        status: 'active'
      }));

      const newGroup = {
        id: groupId,
        ...groupPayload,
        created_at: new Date().toISOString(),
        membersCount: 1 + otherMembers.length,
        members: [creatorMember, ...otherMembers],
        userMemberId: creatorMemberId,
        totalShared: 0,
        userNetBalance: 0,
        userBalanceStatus: 'settled'
      };

      const existing = getLocalStore(`groups_${userId}`, []);
      setLocalStore(`groups_${userId}`, [newGroup, ...existing]);
      return { data: newGroup, error: null };
    }

    try {
      // 1. Insert Group
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert(groupPayload)
        .select()
        .single();

      if (groupErr) throw groupErr;

      // 2. Insert Creator Member
      const { data: creatorMember, error: creatorErr } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          name: userProfile.name || 'You (Creator)',
          email: userProfile.email || '',
          role: 'admin',
          status: 'active'
        })
        .select()
        .single();

      if (creatorErr) throw creatorErr;

      // 3. Insert Additional Initial Members if provided
      const membersToInsert = initialMembers
        .filter(m => m.name && m.name.trim())
        .map(m => ({
          group_id: group.id,
          name: m.name.trim(),
          email: m.email?.trim() || null,
          phone: m.phone?.trim() || null,
          role: 'member',
          status: 'active'
        }));

      let createdMembers = [creatorMember];
      if (membersToInsert.length > 0) {
        const { data: otherMembers, error: membersErr } = await supabase
          .from('group_members')
          .insert(membersToInsert)
          .select();
        if (membersErr) throw membersErr;
        createdMembers = [...createdMembers, ...(otherMembers || [])];
      }

      // 4. Log Activity
      await supabase.from('group_activities').insert({
        group_id: group.id,
        actor_member_id: creatorMember.id,
        activity_type: 'group_created',
        details: { groupName: group.name, memberCount: createdMembers.length }
      });

      return {
        data: {
          ...group,
          membersCount: createdMembers.length,
          members: createdMembers,
          userMemberId: creatorMember.id,
          totalShared: 0,
          userNetBalance: 0,
          userBalanceStatus: 'settled'
        },
        error: null
      };
    } catch (err) {
      console.error('Failed to create group in Supabase:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Fetches complete details of a specific group, including all members, active expenses,
   * confirmed settlements, activity feed, and calculated net balances & debt plan.
   */
  async fetchGroupDetails(groupId, userId) {
    if (!groupId) return { data: null, error: 'Group ID is required.' };

    if (!isSupabaseConfigured()) {
      const groups = getLocalStore(`groups_${userId}`, []);
      const group = groups.find(g => g.id === groupId);
      if (!group) return { data: null, error: 'Group not found.' };

      const expenses = getLocalStore(`expenses_${groupId}`, []);
      const settlements = getLocalStore(`settlements_${groupId}`, []);
      const activities = getLocalStore(`activities_${groupId}`, []);

      const { memberBalances, totalShared, totalSettled } = calculateMemberBalances({
        members: group.members || [],
        expenses,
        settlements
      });

      const simplifiedDebts = calculateSimplifiedDebts(memberBalances);

      return {
        data: {
          group,
          members: group.members || [],
          expenses,
          settlements,
          activities,
          memberBalances,
          simplifiedDebts,
          totalShared,
          totalSettled
        },
        error: null
      };
    }

    try {
      // 1. Fetch Group
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupErr) throw groupErr;

      // 2. Fetch Members
      const { data: members, error: membersErr } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .neq('status', 'removed')
        .order('created_at', { ascending: true });

      if (membersErr) throw membersErr;

      // 3. Fetch Expenses with Shares
      const { data: expenses, error: expErr } = await supabase
        .from('split_expenses')
        .select('*, shares:split_shares(*), payer:group_members!payer_member_id(name)')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('date', { ascending: false });

      if (expErr) throw expErr;

      // 4. Fetch Settlements
      const { data: settlements, error: setlErr } = await supabase
        .from('settlements')
        .select('*, payer:group_members!payer_member_id(name), recipient:group_members!recipient_member_id(name)')
        .eq('group_id', groupId)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (setlErr) throw setlErr;

      // 5. Fetch Activities
      const { data: activities, error: actErr } = await supabase
        .from('group_activities')
        .select('*, actor:group_members!actor_member_id(name)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (actErr) throw actErr;

      // 6. Calculate Balances & Debt Simplification Plan
      const { memberBalances, totalShared, totalSettled } = calculateMemberBalances({
        members: members || [],
        expenses: expenses || [],
        settlements: settlements || []
      });

      const simplifiedDebts = calculateSimplifiedDebts(memberBalances);

      return {
        data: {
          group,
          members: members || [],
          expenses: expenses || [],
          settlements: settlements || [],
          activities: activities || [],
          memberBalances,
          simplifiedDebts,
          totalShared,
          totalSettled
        },
        error: null
      };
    } catch (err) {
      console.error('Error fetching group details:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Creates a new split expense and its associated participant shares.
   */
  async createSplitExpense(groupId, creatorOrPayload, maybePayload) {
    let creatorId, payload;
    if (typeof creatorOrPayload === 'string') {
      creatorId = creatorOrPayload;
      payload = maybePayload || {};
    } else {
      payload = creatorOrPayload || {};
      creatorId = payload.creatorId;
    }

    const {
      payerMemberId,
      title,
      description = '',
      amount,
      totalAmountPaise,
      amount_paise,
      splitMethod = 'equal',
      date = new Date().toISOString().substring(0, 10),
      receiptUrl = null,
      shares = []
    } = payload;

    const amountPaise = totalAmountPaise || amount_paise || toPaise(amount);
    if (!amountPaise || amountPaise <= 0) return { data: null, error: 'Expense amount must be greater than zero.' };
    if (!title || !title.trim()) return { data: null, error: 'Expense title is required.' };
    if (!payerMemberId) return { data: null, error: 'Payer must be selected.' };
    if (!shares || shares.length === 0) return { data: null, error: 'At least one participant must be included.' };

    // Validate shares sum equals total amount
    const totalAllocatedPaise = shares.reduce((sum, s) => sum + (s.allocatedSharePaise || toPaise(s.allocatedShare || 0)), 0);
    if (totalAllocatedPaise !== amountPaise) {
      return { 
        data: null, 
        error: `Share allocation mismatch. Sum of shares (₹${fromPaise(totalAllocatedPaise)}) must equal total (₹${fromPaise(amountPaise)}).` 
      };
    }

    if (!isSupabaseConfigured()) {
      const expenseId = `exp_${Date.now()}`;
      const newExpense = {
        id: expenseId,
        group_id: groupId,
        creator_id: creatorId,
        payer_member_id: payerMemberId,
        title: title.trim(),
        description: description.trim(),
        amount_paise: amountPaise,
        amount: fromPaise(amountPaise),
        split_method: splitMethod,
        date,
        receipt_url: receiptUrl,
        status: 'active',
        created_at: new Date().toISOString(),
        shares: shares.map(s => ({
          id: `share_${Date.now()}_${s.memberId}`,
          expense_id: expenseId,
          member_id: s.memberId,
          allocated_share_paise: s.allocatedSharePaise || toPaise(s.allocatedShare || 0),
          allocatedShare: s.allocatedShare || fromPaise(s.allocatedSharePaise),
          percentage: s.percentage || null,
          status: 'pending'
        }))
      };

      const existing = getLocalStore(`expenses_${groupId}`, []);
      setLocalStore(`expenses_${groupId}`, [newExpense, ...existing]);

      // Log Activity
      const existingActs = getLocalStore(`activities_${groupId}`, []);
      setLocalStore(`activities_${groupId}`, [{
        id: `act_${Date.now()}`,
        group_id: groupId,
        actor_member_id: payerMemberId,
        activity_type: 'expense_created',
        amount_paise: amountPaise,
        details: { title: newExpense.title, amount: newExpense.amount },
        created_at: new Date().toISOString()
      }, ...existingActs]);

      return { data: newExpense, error: null };
    }

    try {
      // 1. Insert Split Expense
      const { data: expense, error: expErr } = await supabase
        .from('split_expenses')
        .insert({
          group_id: groupId,
          creator_id: creatorId,
          payer_member_id: payerMemberId,
          title: title.trim(),
          description: description.trim(),
          amount_paise: amountPaise,
          currency: 'INR',
          split_method: splitMethod,
          date,
          receipt_url: receiptUrl,
          status: 'active'
        })
        .select()
        .single();

      if (expErr) throw expErr;

      // 2. Insert Shares
      const sharesPayload = shares.map(s => ({
        expense_id: expense.id,
        member_id: s.memberId,
        allocated_share_paise: s.allocatedSharePaise || toPaise(s.allocatedShare || 0),
        share_percentage: s.percentage || null,
        status: 'pending'
      }));

      const { data: createdShares, error: sharesErr } = await supabase
        .from('split_shares')
        .insert(sharesPayload)
        .select();

      if (sharesErr) throw sharesErr;

      // 3. Log Activity
      await supabase.from('group_activities').insert({
        group_id: groupId,
        actor_member_id: payerMemberId,
        activity_type: 'expense_created',
        amount_paise: amountPaise,
        details: { title: expense.title, amount: fromPaise(amountPaise) }
      });

      return { data: { ...expense, shares: createdShares }, error: null };
    } catch (err) {
      console.error('Error creating split expense:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Records a confirmed payment/settlement between two group members.
   */
  async recordSettlement(groupId, creatorOrPayload, maybePayload) {
    let createdBy, payload;
    if (typeof creatorOrPayload === 'string') {
      createdBy = creatorOrPayload;
      payload = maybePayload || {};
    } else {
      payload = creatorOrPayload || {};
      createdBy = payload.createdBy;
    }

    const {
      payerMemberId,
      recipientMemberId,
      amount,
      amountPaise: propAmountPaise,
      amount_paise,
      paymentMethod = 'upi',
      notes = ''
    } = payload;

    const amountPaise = propAmountPaise || amount_paise || toPaise(amount);
    if (!amountPaise || amountPaise <= 0) return { data: null, error: 'Settlement amount must be greater than zero.' };
    if (!payerMemberId || !recipientMemberId) return { data: null, error: 'Payer and recipient must both be selected.' };
    if (payerMemberId === recipientMemberId) return { data: null, error: 'Payer and recipient cannot be the same member.' };

    const settlementPayload = {
      group_id: groupId,
      payer_member_id: payerMemberId,
      recipient_member_id: recipientMemberId,
      amount_paise: amountPaise,
      currency: 'INR',
      payment_method: paymentMethod,
      notes: notes.trim(),
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      created_by: createdBy
    };

    if (!isSupabaseConfigured()) {
      const settlementId = `set_${Date.now()}`;
      const newSettlement = {
        id: settlementId,
        ...settlementPayload,
        amount: fromPaise(amountPaise),
        created_at: new Date().toISOString()
      };

      const existing = getLocalStore(`settlements_${groupId}`, []);
      setLocalStore(`settlements_${groupId}`, [newSettlement, ...existing]);

      // Activity
      const existingActs = getLocalStore(`activities_${groupId}`, []);
      setLocalStore(`activities_${groupId}`, [{
        id: `act_${Date.now()}`,
        group_id: groupId,
        actor_member_id: payerMemberId,
        activity_type: 'settlement_recorded',
        amount_paise: amountPaise,
        details: { amount: newSettlement.amount, paymentMethod },
        created_at: new Date().toISOString()
      }, ...existingActs]);

      return { data: newSettlement, error: null };
    }

    try {
      const { data: settlement, error: setlErr } = await supabase
        .from('settlements')
        .insert(settlementPayload)
        .select()
        .single();

      if (setlErr) throw setlErr;

      // Activity
      await supabase.from('group_activities').insert({
        group_id: groupId,
        actor_member_id: payerMemberId,
        activity_type: 'settlement_recorded',
        amount_paise: amountPaise,
        details: { amount: fromPaise(amountPaise), paymentMethod }
      });

      return { data: settlement, error: null };
    } catch (err) {
      console.error('Error recording settlement:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Invites a new participant to a group with a secure expiration token.
   */
  async inviteMember(groupId, userOrPayload, maybePayload) {
    let inviterId, payload;
    if (typeof userOrPayload === 'string') {
      inviterId = userOrPayload;
      payload = maybePayload || {};
    } else {
      payload = userOrPayload || {};
      inviterId = payload.inviterId;
    }

    const { name, email = null, phone = null } = payload;
    if (!name || !name.trim()) return { data: null, error: 'Member name is required.' };

    const token = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://finovo.app';
    const inviteUrl = `${baseUrl}/join?token=${token}`;

    if (!isSupabaseConfigured()) {
      const memberId = `mem_inv_${Date.now()}`;
      const newMember = {
        id: memberId,
        group_id: groupId,
        user_id: null,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role: 'member',
        status: 'invited',
        invitation_token_hash: token,
        invitation_expires_at: expiresAt,
        created_at: new Date().toISOString()
      };

      return { 
        data: { 
          member: newMember, 
          inviteUrl, 
          inviteLink: inviteUrl, 
          token, 
          inviteToken: token 
        }, 
        error: null 
      };
    }

    try {
      // 1. Insert Member
      const { data: member, error: memErr } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          name: name.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          role: 'member',
          status: 'invited',
          invitation_token_hash: token,
          invitation_expires_at: expiresAt
        })
        .select()
        .single();

      if (memErr) throw memErr;

      // 2. Insert Invitation
      const { data: invitation, error: invErr } = await supabase
        .from('group_invitations')
        .insert({
          group_id: groupId,
          inviter_id: inviterId,
          member_id: member.id,
          recipient_email: email?.trim() || null,
          recipient_phone: phone?.trim() || null,
          token_hash: token,
          expires_at: expiresAt,
          status: 'pending'
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 3. Activity
      await supabase.from('group_activities').insert({
        group_id: groupId,
        activity_type: 'member_invited',
        details: { memberName: member.name, email: member.email, phone: member.phone }
      });

      return { 
        data: { 
          member, 
          invitation, 
          inviteUrl, 
          inviteLink: inviteUrl, 
          token, 
          inviteToken: token 
        }, 
        error: null 
      };
    } catch (err) {
      console.error('Error inviting member:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Accepts an invitation using a secure token.
   */
  async acceptInvitation(token, userId, userProfile = {}) {
    if (!token) return { data: null, error: 'Invitation token is required.' };

    if (!isSupabaseConfigured()) {
      return { data: { message: 'Invitation accepted.' }, error: null };
    }

    try {
      // 1. Lookup invitation
      const { data: inv, error: invErr } = await supabase
        .from('group_invitations')
        .select('*, group:groups(*)')
        .eq('token_hash', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invErr || !inv) {
        return { data: null, error: 'Invalid or expired invitation token.' };
      }

      // 2. Update Member Record
      const { error: memErr } = await supabase
        .from('group_members')
        .update({
          user_id: userId,
          name: userProfile.name || inv.recipient_email || 'Member',
          status: 'active'
        })
        .eq('id', inv.member_id);

      if (memErr) throw memErr;

      // 3. Update Invitation Status
      await supabase
        .from('group_invitations')
        .update({
          status: 'accepted',
          accepted_user_id: userId
        })
        .eq('id', inv.id);

      // 4. Activity
      await supabase.from('group_activities').insert({
        group_id: inv.group_id,
        activity_type: 'invitation_accepted',
        details: { userName: userProfile.name || 'Member' }
      });

      return { data: { group: inv.group }, error: null };
    } catch (err) {
      console.error('Error accepting invitation:', err);
      return { data: null, error: err.message };
    }
  },

  /**
   * Deletes (soft deletes) an expense and reverts its financial impact.
   */
  async deleteSplitExpense(expenseId, groupId, actorId) {
    if (!expenseId) return { data: null, error: 'Expense ID required.' };

    if (!isSupabaseConfigured()) {
      const expenses = getLocalStore(`expenses_${groupId}`, []);
      const updated = expenses.map(e => e.id === expenseId ? { ...e, status: 'deleted' } : e);
      setLocalStore(`expenses_${groupId}`, updated);
      return { data: { success: true }, error: null };
    }

    try {
      const { error: delErr } = await supabase
        .from('split_expenses')
        .update({ status: 'deleted' })
        .eq('id', expenseId);

      if (delErr) throw delErr;

      await supabase.from('group_activities').insert({
        group_id: groupId,
        activity_type: 'expense_deleted',
        details: { expenseId }
      });

      return { data: { success: true }, error: null };
    } catch (err) {
      console.error('Error deleting expense:', err);
      return { data: null, error: err.message };
    }
  }
};
