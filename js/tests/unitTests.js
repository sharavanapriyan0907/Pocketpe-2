/* ==========================================================================
   POCKETPE - AUTOMATED UNIT TEST SUITE
   Tests for:
   1. Spam Score calculation, time decay, trust weighting, threshold, extra signals & rate limits
   2. Split-Bill calculation, equal split rounding, custom split validation, and min-cash-flow algorithm
   ========================================================================== */

import { FraudEngine, RISK_LEVELS } from '../engines/fraudEngine.js';
import { SplitEngine } from '../engines/splitEngine.js';
import { UpiQrEngine, parseUpiQr, getCategoryFromMcc, getPocketPeCategory, getWalletForCategory } from '../engines/upiQrEngine.js';
import { CategoryEngine } from '../engines/categoryEngine.js';
import { supabaseService } from '../services/supabaseService.js';
import { stateManager } from '../state.js';
import { NavigationManager } from '../ui/navigation.js';

export class UnitTests {
  static runAll() {
    const results = [];
    const startTime = performance.now();

    // Snapshot original user state to prevent tests from dirtying active session
    const originalUserState = JSON.parse(JSON.stringify(stateManager.getState().user || {}));

    const assert = (description, condition, details = '') => {
      if (condition) {
        results.push({ name: description, passed: true, details });
      } else {
        results.push({ name: description, passed: false, details });
      }
    };

    // =========================================================================
    // FEATURE 1: FRAUD DETECTION & SPAM SCORE TESTS
    // =========================================================================

    // Test 1: Basic Spam Score Ratio (unique_reporters / unique_users_who_interacted)
    (() => {
      const now = Date.now();
      const mockState = {
        fraudDetection: {
          reports: [
            { reporterId: 'u1', reportedUpiId: 'test@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u2', reportedUpiId: 'test@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u3', reportedUpiId: 'test@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u4', reportedUpiId: 'test@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u5', reportedUpiId: 'test@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
          ],
          interactions: {
            'test@upi': ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'], // 10 unique users
          },
          upiRegistry: {},
          appeals: [],
        },
      };

      const evalResult = FraudEngine.evaluateUpiRisk('test@upi', mockState);
      // 5 unique reporters / 10 unique interactions = 0.50 score
      assert(
        'Spam Score: Basic ratio unique_reporters / unique_users_who_interacted',
        evalResult.score === 0.5 && evalResult.uniqueReporters === 5 && evalResult.interactedCount === 10,
        `Expected 0.50, got ${evalResult.score}`
      );
    })();

    // Test 2: Time Decay (reports lose weight over time with 30-day half-life)
    (() => {
      const now = Date.now();
      const freshFactor = FraudEngine.calculateTimeDecay(now, now);
      const thirtyDaysAgoFactor = FraudEngine.calculateTimeDecay(now - 30 * 86400000, now);
      const sixtyDaysAgoFactor = FraudEngine.calculateTimeDecay(now - 60 * 86400000, now);

      assert(
        'Time Decay: Fresh report has weight 1.0, 30 days old has ~0.50, 60 days has ~0.25',
        Math.abs(freshFactor - 1.0) < 0.01 &&
          Math.abs(thirtyDaysAgoFactor - 0.5) < 0.02 &&
          Math.abs(sixtyDaysAgoFactor - 0.25) < 0.02,
        `Fresh: ${freshFactor.toFixed(2)}, 30d: ${thirtyDaysAgoFactor.toFixed(2)}, 60d: ${sixtyDaysAgoFactor.toFixed(2)}`
      );
    })();

    // Test 3: Trust Weighting (reports from low-trust accounts count less)
    (() => {
      const now = Date.now();
      const mockState = {
        fraudDetection: {
          reports: [
            // 5 reports, but each reporter has low trust 0.2
            { reporterId: 'u1', reportedUpiId: 'lowtrust@upi', reporterTrust: 0.2, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u2', reportedUpiId: 'lowtrust@upi', reporterTrust: 0.2, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u3', reportedUpiId: 'lowtrust@upi', reporterTrust: 0.2, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u4', reportedUpiId: 'lowtrust@upi', reporterTrust: 0.2, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u5', reportedUpiId: 'lowtrust@upi', reporterTrust: 0.2, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
          ],
          interactions: {
            'lowtrust@upi': ['u1', 'u2', 'u3', 'u4', 'u5'],
          },
          upiRegistry: {},
          appeals: [],
        },
      };

      const evalResult = FraudEngine.evaluateUpiRisk('lowtrust@upi', mockState);
      // Weighted sum: 5 * 0.2 = 1.0; 1.0 / 5 interactions = 0.20 score
      assert(
        'Trust Weighting: Low-trust reports count less in final score',
        evalResult.score === 0.2,
        `Expected weighted score 0.20, got ${evalResult.score}`
      );
    })();

    // Test 4: Minimum Report Threshold (gated below 5 reports)
    (() => {
      const now = Date.now();
      const mockStateBelow = {
        fraudDetection: {
          reports: [
            // Only 2 reports (below 5 threshold)
            { reporterId: 'u1', reportedUpiId: 'few@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
            { reporterId: 'u2', reportedUpiId: 'few@upi', reporterTrust: 1.0, createdAt: new Date(now).toISOString(), reason: 'Fake collect request' },
          ],
          interactions: { 'few@upi': ['u1', 'u2'] },
          upiRegistry: {},
          appeals: [],
        },
      };

      const evalBelow = FraudEngine.evaluateUpiRisk('few@upi', mockStateBelow);
      assert(
        'Threshold Enforcement: Below 5 reports does not trigger High risk badge',
        evalBelow.meetsThreshold === false && evalBelow.level === RISK_LEVELS.LOW,
        `Level: ${evalBelow.level}, meetsThreshold: ${evalBelow.meetsThreshold}`
      );
    })();

    // Test 5: Extra Signals (account age, velocity, name mismatch)
    (() => {
      const now = Date.now();
      const mockState = {
        fraudDetection: {
          reports: Array.from({ length: 6 }).map((_, i) => ({
            reporterId: `u_${i}`,
            reportedUpiId: 'scammer@upi',
            reporterTrust: 1.0,
            createdAt: new Date(now).toISOString(),
            reason: 'Fake collect request',
          })),
          interactions: { 'scammer@upi': Array.from({ length: 10 }).map((_, i) => `u_${i}`) },
          upiRegistry: {
            'scammer@upi': {
              registeredDaysAgo: 3, // < 14 days
              collectVelocity1h: 22, // > 10 in 1 hour
              nameMismatch: true,
              registeredName: 'Unknown Prepaid SIM',
            },
          },
          appeals: [],
        },
      };

      const evalResult = FraudEngine.evaluateUpiRisk('scammer@upi', mockState);
      assert(
        'Extra Signals: Detects newly registered account, abnormal velocity, and name mismatch',
        evalResult.extraSignals.length === 3 && evalResult.level === RISK_LEVELS.HIGH,
        `Signals count: ${evalResult.extraSignals.length}, Level: ${evalResult.level}`
      );
    })();

    // Test 6: Appeals and Under Review status
    (() => {
      const mockState = {
        fraudDetection: {
          reports: Array.from({ length: 6 }).map((_, i) => ({
            reporterId: `u_${i}`,
            reportedUpiId: 'appealed@upi',
            reporterTrust: 1.0,
            createdAt: new Date().toISOString(),
            reason: 'Impersonation',
          })),
          interactions: { 'appealed@upi': Array.from({ length: 8 }).map((_, i) => `u_${i}`) },
          upiRegistry: {},
          appeals: [
            { id: 'app_1', upiId: 'appealed@upi', status: 'under_review', createdAt: new Date().toISOString() },
          ],
        },
      };

      const evalResult = FraudEngine.evaluateUpiRisk('appealed@upi', mockState);
      assert(
        'Appeals: Marks flagged UPI as underReview while pending moderator audit',
        evalResult.underReview === true && evalResult.appeal !== null,
        `Under review: ${evalResult.underReview}`
      );
    })();

    // Test 7: Duplicate Report & Rate Limiting Check
    (() => {
      const existingReport = {
        reportedUpiId: 'test.dup@upi',
        reason: 'Fake collect request',
        reporterId: 'usr_test_reporter',
      };

      // First submission
      const firstRes = FraudEngine.submitReport(existingReport);
      // Attempt duplicate submission
      const secondRes = FraudEngine.submitReport(existingReport);

      assert(
        'Abuse Protection: Blocks duplicate report by same user for same UPI ID',
        secondRes.success === false && secondRes.error.includes('already reported'),
        secondRes.error || 'Duplicate was not blocked'
      );
    })();

    // =========================================================================
    // FEATURE 2: SPLIT-BILL WALLET & SPLIT ENGINE TESTS
    // =========================================================================

    // Test 8: Equal Split Exact Paisa Summation (No Float Errors)
    (() => {
      const members = ['m1', 'm2', 'm3'];
      const shares = SplitEngine.calculateEqualShares(100, members);
      const sum = shares.reduce((acc, s) => acc + s.shareAmount, 0);

      // ₹100 split 3 ways: 33.34, 33.33, 33.33 -> Exactly 100.00
      assert(
        'Equal Split: ₹100 split between 3 people sums strictly to 100.00',
        Math.abs(sum - 100) < 0.001 && shares[0].shareAmount === 33.34 && shares[1].shareAmount === 33.33,
        `Shares: ${shares.map((s) => s.shareAmount).join(', ')} => Sum: ${sum}`
      );
    })();

    // Test 9: Custom Split Validation
    (() => {
      const validShares = [
        { memberId: 'm1', shareAmount: 250 },
        { memberId: 'm2', shareAmount: 150 },
        { memberId: 'm3', shareAmount: 100 },
      ];
      const invalidShares = [
        { memberId: 'm1', shareAmount: 200 },
        { memberId: 'm2', shareAmount: 100 },
      ];

      const validCheck = SplitEngine.validateCustomShares(500, validShares);
      const invalidCheck = SplitEngine.validateCustomShares(500, invalidShares);

      assert(
        'Custom Split: Validates that custom share inputs exactly match expense total',
        validCheck.valid === true && invalidCheck.valid === false,
        `Valid check: ${validCheck.valid}, Invalid check: ${invalidCheck.valid}`
      );
    })();

    // Test 10: Net Balance Calculation Across Group Expenses
    (() => {
      const mockState = {
        splitBill: {
          groupMembers: [
            { id: 'm_alice', groupId: 'g1', name: 'Alice' },
            { id: 'm_bob', groupId: 'g1', name: 'Bob' },
            { id: 'm_charlie', groupId: 'g1', name: 'Charlie' },
          ],
          expenses: [
            // Alice paid ₹300 for Alice, Bob, Charlie (₹100 each)
            {
              id: 'e1',
              groupId: 'g1',
              amount: 300,
              paidBy: 'm_alice',
              shares: [
                { memberId: 'm_alice', shareAmount: 100 },
                { memberId: 'm_bob', shareAmount: 100 },
                { memberId: 'm_charlie', shareAmount: 100 },
              ],
            },
            // Bob paid ₹150 for Bob and Charlie (₹75 each)
            {
              id: 'e2',
              groupId: 'g1',
              amount: 150,
              paidBy: 'm_bob',
              shares: [
                { memberId: 'm_bob', shareAmount: 75 },
                { memberId: 'm_charlie', shareAmount: 75 },
              ],
            },
          ],
          settlements: [],
        },
      };

      const balances = SplitEngine.calculateGroupBalances('g1', mockState);

      // Alice: paid 300, share 100 => Net +200
      // Bob: paid 150, share (100 + 75 = 175) => Net -25
      // Charlie: paid 0, share (100 + 75 = 175) => Net -175
      assert(
        'Net Balances: Accurately computes net owed/owing across multiple expenses and payers',
        balances['m_alice'].netBalance === 200 &&
          balances['m_bob'].netBalance === -25 &&
          balances['m_charlie'].netBalance === -175,
        `Alice: ${balances['m_alice'].netBalance}, Bob: ${balances['m_bob'].netBalance}, Charlie: ${balances['m_charlie'].netBalance}`
      );
    })();

    // Test 11: Simplified Debt Settlement (Min-Cash-Flow)
    (() => {
      // 3 friends with cross debts:
      // Alice is owed 200
      // Charlie owes 175, Bob owes 25
      // Min cash flow should produce 2 transactions directly to Alice (Bob -> Alice ₹25, Charlie -> Alice ₹175)
      const mockState = {
        splitBill: {
          groupMembers: [
            { id: 'm_alice', groupId: 'g1', name: 'Alice' },
            { id: 'm_bob', groupId: 'g1', name: 'Bob' },
            { id: 'm_charlie', groupId: 'g1', name: 'Charlie' },
          ],
          expenses: [
            {
              id: 'e1',
              groupId: 'g1',
              amount: 300,
              paidBy: 'm_alice',
              shares: [
                { memberId: 'm_alice', shareAmount: 100 },
                { memberId: 'm_bob', shareAmount: 100 },
                { memberId: 'm_charlie', shareAmount: 100 },
              ],
            },
            {
              id: 'e2',
              groupId: 'g1',
              amount: 150,
              paidBy: 'm_bob',
              shares: [
                { memberId: 'm_bob', shareAmount: 75 },
                { memberId: 'm_charlie', shareAmount: 75 },
              ],
            },
          ],
          settlements: [],
        },
      };

      const simplified = SplitEngine.calculateSimplifiedSettlements('g1', mockState);

      const totalSettledAmount = simplified.reduce((acc, s) => acc + s.amount, 0);

      assert(
        'Min-Cash-Flow: Reduces circular cross-debts into minimal direct settlement payments',
        simplified.length === 2 && totalSettledAmount === 200,
        `Simplified transactions: ${simplified.length} (Total: ₹${totalSettledAmount})`
      );
    })();

    // Test 12: Gentle Reminder Text Generation
    (() => {
      const fromMem = { name: 'Ravi' };
      const toMem = { name: 'Sharath' };
      const msg = SplitEngine.generateGentleReminder(fromMem, toMem, 350, 'Goa Trip');

      assert(
        'Gentle Reminders: Produces polite, student-friendly reminder message',
        msg.includes('Ravi') && msg.includes('350') && msg.includes('Goa Trip'),
        `Generated: "${msg}"`
      );
    })();

    // =========================================================================
    // FEATURE 3: SUPABASE EMAIL/PASSWORD AUTHENTICATION & USER.ID EXPOSURE
    // =========================================================================

    // Test 13: Supabase Service Configuration & State Access
    (() => {
      const config = supabaseService.getConfig();
      assert(
        'Supabase Config: Supabase service correctly exposes project endpoint configuration',
        typeof config.url === 'string' && typeof config.anonKey === 'string' && typeof config.isConfigured === 'boolean',
        `Configured URL: ${config.url}`
      );
    })();

    // Test 14: Non-Anonymous Auth Enforcement (Validates required credentials)
    (() => {
      const invalidEmail = supabaseService.validateCredentials('', '123456', 'Test');
      const invalidPass = supabaseService.validateCredentials('test@univ.edu', '123', 'Test');
      const valid = supabaseService.validateCredentials('student@univ.edu', 'secret123', 'Test Student');

      assert(
        'Non-Anonymous Enforcement: Strictly requires valid email and min 6-char password',
        invalidEmail.valid === false && invalidPass.valid === false && valid.valid === true,
        'Validated non-anonymous authentication rules'
      );
    })();

    // Test 15: Expose Authenticated Supabase user.id to the Existing Application
    (() => {
      const mockSupabaseUser = {
        id: 'sb_user_uuid_789456123',
        email: 'student.priya@university.edu',
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        user_metadata: {
          full_name: 'Priya Sharma',
        },
      };

      stateManager.setAuthUser(mockSupabaseUser);

      const currentUserId = stateManager.getUserId();
      const state = stateManager.getState();

      assert(
        'User.ID Exposure: Authenticated Supabase user.id is exposed globally across application state',
        currentUserId === 'sb_user_uuid_789456123' &&
          state.user.id === 'sb_user_uuid_789456123' &&
          state.user.email === 'student.priya@university.edu' &&
          state.user.name === 'Priya Sharma' &&
          state.user.isAuthenticated === true,
        `Exposed ID: ${currentUserId}, Auth: ${state.user.isAuthenticated}`
      );
    })();

    // Test 16: User-Scoped Wallets and Preferences Isolation
    (() => {
      const userA = { id: 'usr_alpha_111', email: 'alpha@test.com', user_metadata: { full_name: 'Alpha User' } };
      const userB = { id: 'usr_beta_222', email: 'beta@test.com', user_metadata: { full_name: 'Beta User' } };

      // Switch to User A and update merchant preference
      stateManager.setAuthUser(userA);
      stateManager.state.learnedMerchants['campus.coffee@upi'] = { category: 'Food & Dining', learnedAt: Date.now() };
      stateManager.saveState();

      // Switch to User B
      stateManager.setAuthUser(userB);
      const userBPreference = stateManager.state.learnedMerchants['campus.coffee@upi'];

      // Switch back to User A
      stateManager.setAuthUser(userA);
      const userAPreference = stateManager.state.learnedMerchants['campus.coffee@upi'];

      assert(
        'User Scoping: Authenticated user.id isolates wallets and merchant preferences per user',
        !userBPreference && !!userAPreference,
        'Verified preferences are partitioned by user.id'
      );
    })();

    // Test 17: Log Out & Clear Auth State
    (() => {
      stateManager.clearAuthUser();
      const state = stateManager.getState();
      const isAuth = stateManager.isUserAuthenticated();

      assert(
        'Log Out Flow: Sign out cleans active session, reverts to guest state and un-authenticates user',
        isAuth === false && state.user.isAuthenticated === false && state.user.id === 'usr_guest',
        `Current User: ${state.user.name}, ID: ${state.user.id}`
      );
    })();

    // Test 18: Profile Functionality (Update Display Name)
    (() => {
      const testUser = { id: 'usr_edit_test', email: 'editor@test.com', user_metadata: { full_name: 'Original Name' } };
      stateManager.setAuthUser(testUser);

      // Mutate display name
      stateManager.state.user.name = 'Updated Student Name';
      stateManager.saveState();

      const updated = stateManager.getState().user.name;

      assert(
        'Profile Editing: Allows updating student display name and persists in state',
        updated === 'Updated Student Name',
        `Display Name: ${updated}`
      );
    })();

    // Test 19: Google OAuth Service & Profile Mapping
    (() => {
      const hasGoogleMethod = typeof supabaseService.signInWithGoogle === 'function';

      // Mock Google OAuth user object returned by Supabase
      const mockGoogleUser = {
        id: 'google_oauth_usr_998877',
        email: 'sharath.student@gmail.com',
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        app_metadata: {
          provider: 'google',
          providers: ['google'],
        },
        user_metadata: {
          full_name: 'Sharath Google User',
          name: 'Sharath Google User',
          avatar_url: 'https://lh3.googleusercontent.com/a/mock-avatar-123',
          picture: 'https://lh3.googleusercontent.com/a/mock-avatar-123',
          email: 'sharath.student@gmail.com',
        },
      };

      stateManager.setAuthUser(mockGoogleUser);
      const state = stateManager.getState();

      assert(
        'Google OAuth: Service provides signInWithGoogle and captures Google avatar, provider and name',
        hasGoogleMethod &&
          state.user.id === 'google_oauth_usr_998877' &&
          state.user.email === 'sharath.student@gmail.com' &&
          state.user.name === 'Sharath Google User' &&
          state.user.provider === 'google' &&
          state.user.avatarUrl === 'https://lh3.googleusercontent.com/a/mock-avatar-123' &&
          state.user.isAuthenticated === true,
        `Provider: ${state.user.provider}, Avatar: ${state.user.avatarUrl}`
      );
    })();

    // =========================================================================
    // FEATURE 4: UPI QR CODE PARSING, MCC MAPPING & PERSONAL QR MEMORY TESTS
    // =========================================================================

    // Test 19: parseUpiQr - Full parameter extraction & only storing existing fields
    (() => {
      const rawUri = 'upi://pay?pa=medical@upi&pn=ABC%20Medical&mc=5912&am=250&cu=INR';
      const parsed = parseUpiQr(rawUri);

      assert(
        'parseUpiQr: Extracts pa, pn, mc, amount, and cu without storing absent fields',
        parsed &&
          parsed.isUpi === true &&
          parsed.pa === 'medical@upi' &&
          parsed.pn === 'ABC Medical' &&
          parsed.mc === '5912' &&
          parsed.amount === 250 &&
          parsed.cu === 'INR' &&
          parsed.tn === undefined &&
          parsed.tr === undefined &&
          parsed.mid === undefined,
        `Parsed: ${JSON.stringify(parsed)}`
      );
    })();

    // Test 20: parseUpiQr - URL-decoding (+, %40) & extended UPI parameters
    (() => {
      const complexUri = 'UPI://PAY?pa=store%40upi&pn=Super+Mart&mc=5411&am=120.75&cu=INR&tn=Monthly+Groceries&tr=TXN98765&mid=MID001&msid=MSID002&mtid=MTID003';
      const parsed = parseUpiQr(complexUri);

      assert(
        'parseUpiQr: Handles URL-decoding (+, %40) and captures tn, tr, mid, msid, mtid',
        parsed &&
          parsed.isUpi === true &&
          parsed.pa === 'store@upi' &&
          parsed.pn === 'Super Mart' &&
          parsed.mc === '5411' &&
          parsed.amount === 120.75 &&
          parsed.tn === 'Monthly Groceries' &&
          parsed.tr === 'TXN98765' &&
          parsed.mid === 'MID001' &&
          parsed.msid === 'MSID002' &&
          parsed.mtid === 'MTID003',
        `Parsed: ${JSON.stringify(parsed)}`
      );
    })();

    // Test 21: parseUpiQr - Non-UPI QR and malformed QR safety
    (() => {
      const nonUpi1 = parseUpiQr('https://example.com/pay');
      const nonUpi2 = parseUpiQr('WIFI:S:MyNetwork;T:WPA;P:secret123;;');
      const nonUpi3 = parseUpiQr('upi://pay?'); // missing pa
      const nonUpi4 = parseUpiQr('');
      const nonUpi5 = parseUpiQr(null);

      assert(
        'parseUpiQr: Rejects non-UPI & malformed QR codes with error message without crashing',
        nonUpi1.isUpi === false &&
          nonUpi1.error === 'This QR is not a supported UPI payment QR.' &&
          nonUpi2.isUpi === false &&
          nonUpi2.error === 'This QR is not a supported UPI payment QR.' &&
          nonUpi3.isUpi === false &&
          nonUpi4.isUpi === false &&
          nonUpi5.isUpi === false,
        `Handled 5 non-UPI / malformed payloads gracefully`
      );
    })();

    // Test 22: getCategoryFromMcc & getPocketPeCategory - Centralized Category Mapping
    (() => {
      const m5912 = getCategoryFromMcc('5912'); // Medical / Pharmacy
      const m5812 = getCategoryFromMcc('5812'); // Restaurant
      const m5814 = getCategoryFromMcc('5814'); // Fast Food
      const m5411 = getCategoryFromMcc('5411'); // Grocery
      const m7230 = getCategoryFromMcc('7230'); // Salon / Barber
      const m4121 = getCategoryFromMcc('4121'); // Transportation / Taxi
      const m5541 = getCategoryFromMcc('5541'); // Fuel
      const m4900 = getCategoryFromMcc('4900'); // Utilities
      const m8220 = getCategoryFromMcc('8220'); // Education

      const p5912 = getPocketPeCategory(m5912); // Medical
      const p5812 = getPocketPeCategory(m5812); // Food
      const p5814 = getPocketPeCategory(m5814); // Food
      const p5411 = getPocketPeCategory(m5411); // Grocery
      const p7230 = getPocketPeCategory(m7230); // Personal Care
      const p4121 = getPocketPeCategory(m4121); // Transportation
      const p5541 = getPocketPeCategory(m5541); // Fuel
      const p4900 = getPocketPeCategory(m4900); // Utilities
      const p8220 = getPocketPeCategory(m8220); // Education

      assert(
        'getCategoryFromMcc: Centralized mapping maps MCC codes to standard categories and PocketPe categories',
        m5912 === 'Medical / Pharmacy' &&
          m5812 === 'Restaurant' &&
          m5814 === 'Fast Food' &&
          m5411 === 'Grocery' &&
          m7230 === 'Salon / Barber' &&
          m4121 === 'Transportation / Taxi' &&
          m5541 === 'Fuel' &&
          m4900 === 'Utilities' &&
          m8220 === 'Education' &&
          p5912 === 'Medical' &&
          p5812 === 'Food' &&
          p5814 === 'Food' &&
          p5411 === 'Grocery' &&
          p7230 === 'Personal Care' &&
          p4121 === 'Transportation' &&
          p5541 === 'Fuel' &&
          p4900 === 'Utilities' &&
          p8220 === 'Education',
        `Mappings: 5912->${m5912}->${p5912}, 5812->${m5812}->${p5812}, 5541->${m5541}->${p5541}`
      );
    })();

    // Test 23: getCategoryFromMcc - Missing, "0000", null, and unknown MCC returns null
    (() => {
      const nullRes = getCategoryFromMcc(null);
      const emptyRes = getCategoryFromMcc('');
      const zeroRes = getCategoryFromMcc('0000');
      const singleZeroRes = getCategoryFromMcc('0');
      const unknownRes = getCategoryFromMcc('9999');

      assert(
        'getCategoryFromMcc: Returns null strictly for missing, "0000", null, or unknown MCC',
        nullRes === null &&
          emptyRes === null &&
          zeroRes === null &&
          singleZeroRes === null &&
          unknownRes === null,
        `Results: null->${nullRes}, 0000->${zeroRes}, 9999->${unknownRes}`
      );
    })();

    // Test 24: getWalletForCategory - Category to User Wallet mapping & fallback
    (() => {
      const mockWallets = [
        { id: 'wallet_food', name: 'Food', category: 'Food & Dining' },
        { id: 'wallet_transport', name: 'Transport', category: 'Transport & Fuel' },
        { id: 'wallet_college', name: 'College', category: 'College & Education' },
        { id: 'wallet_friends', name: 'Friends', category: 'Friends & Social' },
        { id: 'wallet_free', name: 'Free Money', category: 'Unallocated Cushion' },
      ];

      const foodMatch = getWalletForCategory('Food', mockWallets);
      const groceryMatch = getWalletForCategory('Grocery', mockWallets);
      const transportMatch = getWalletForCategory('Transportation', mockWallets);
      const fuelMatch = getWalletForCategory('Fuel', mockWallets);
      const eduMatch = getWalletForCategory('Education', mockWallets);
      const medNoMatch = getWalletForCategory('Medical', mockWallets);

      // When user adds a Medical wallet
      const walletsWithMed = [...mockWallets, { id: 'wallet_med', name: 'Medical Wallet', category: 'Medical' }];
      const medMatch = getWalletForCategory('Medical', walletsWithMed);

      assert(
        'getWalletForCategory: Correctly matches user purpose wallets and returns "No matching wallet found." if missing',
        foodMatch.wallet?.id === 'wallet_food' &&
          groceryMatch.wallet?.id === 'wallet_food' &&
          transportMatch.wallet?.id === 'wallet_transport' &&
          fuelMatch.wallet?.id === 'wallet_transport' &&
          eduMatch.wallet?.id === 'wallet_college' &&
          medNoMatch.matched === false &&
          medNoMatch.message === 'No matching wallet found.' &&
          medMatch.matched === true &&
          medMatch.wallet?.id === 'wallet_med',
        `medNoMatch message: "${medNoMatch.message}", medMatch: ${medMatch.wallet?.id}`
      );
    })();

    // Test 25: Personal QR First-Time Save & Query
    (() => {
      const testUserId = 'usr_alice_test_101';
      const upiId = 'ravi@upi';

      const saveResult = supabaseService.saveMerchantPreference({
        userId: testUserId,
        upiId,
        merchantName: 'Ravi',
        detectedMcc: null,
        category: 'Friends & Social',
        walletId: 'wallet_friends',
        source: 'user',
      });

      const retrieved = supabaseService.getLocalPreference(testUserId, upiId);

      assert(
        'Personal QR First-Time Save: Saves user_id + upi_id preference to merchant_preferences',
        saveResult.success === true &&
          retrieved !== null &&
          retrieved.upiId === 'ravi@upi' &&
          retrieved.merchantName === 'Ravi' &&
          retrieved.walletId === 'wallet_friends' &&
          retrieved.source === 'user',
        `Retrieved: ${JSON.stringify(retrieved)}`
      );
    })();

    // Test 26: Returning Personal QR Lookup & User Scoping Isolation
    (() => {
      const userAId = 'usr_alice_test_101';
      const userBId = 'usr_bob_test_202';
      const commonUpiId = 'ravi@upi';

      // User B classifies the same person (Ravi) as Travel/Transport
      supabaseService.saveMerchantPreference({
        userId: userBId,
        upiId: commonUpiId,
        merchantName: 'Ravi Cab',
        detectedMcc: null,
        category: 'Transport & Fuel',
        walletId: 'wallet_transport',
        source: 'user',
      });

      const prefForUserA = supabaseService.getLocalPreference(userAId, commonUpiId);
      const prefForUserB = supabaseService.getLocalPreference(userBId, commonUpiId);

      assert(
        'Personal QR User Scoping: Multi-user isolation prevents preference collisions for same UPI ID',
        prefForUserA &&
          prefForUserB &&
          prefForUserA.walletId === 'wallet_friends' &&
          prefForUserB.walletId === 'wallet_transport',
        `User A suggests: ${prefForUserA?.walletId}, User B suggests: ${prefForUserB?.walletId}`
      );

      // Clean up and restore original user state so running tests does not disrupt user session
      if (originalUserState && originalUserState.isAuthenticated && originalUserState.supabaseUser) {
        stateManager.setAuthUser(originalUserState.supabaseUser);
      } else if (originalUserState && originalUserState.id) {
        stateManager.state.user = originalUserState;
        stateManager.loadUserScopedData(originalUserState.id);
        stateManager.notify('auth:changed', stateManager.state.user);
      } else {
        stateManager.resetToDemoData();
      }
    })();

    const endTime = performance.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;
    const passedCount = results.filter((r) => r.passed).length;
    const allPassed = passedCount === results.length;

    console.log(
      `%c🧪 PocketPe Unit Test Suite: ${passedCount}/${results.length} PASSED in ${durationMs}ms`,
      allPassed ? 'color: #10b981; font-weight: bold;' : 'color: #ef4444; font-weight: bold;'
    );

    return {
      allPassed,
      passedCount,
      totalCount: results.length,
      durationMs,
      results,
    };
  }

  /**
   * Render and show the test results in the DOM modal
   */
  static showTestResultsModal() {
    const report = this.runAll();
    const modal = document.getElementById('modal-unit-tests');
    if (!modal) return;

    const body = modal.querySelector('.sheet-body');
    const footer = modal.querySelector('.sheet-footer');
    if (!body || !footer) return;

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 14px;">
        <div style="font-size: 2.5rem; margin-bottom: 4px;">${report.allPassed ? '✅' : '❌'}</div>
        <h3 class="h3" style="color: var(--text-primary);">Test Execution Results</h3>
        <p class="subtitle">Fraud Detection • Split-Bill Wallet • Supabase Authentication</p>
      </div>

      <!-- Test Summary Card -->
      <div class="card" style="padding: 14px; background: ${report.allPassed ? 'var(--success-light)' : 'var(--danger-light)'}; border: 1.5px solid ${report.allPassed ? 'var(--success-border)' : 'var(--danger-border)'}; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <div>
          <div style="font-size: var(--text-xs); font-weight: 700; color: ${report.allPassed ? 'var(--success)' : 'var(--danger)'};">
            ${report.allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}
          </div>
          <div style="font-size: var(--text-md); font-weight: 800; color: var(--text-primary);">
            ${report.passedCount} / ${report.totalCount} Tests Successful
          </div>
        </div>
        <span class="badge" style="background: var(--bg-surface);">${report.durationMs}ms</span>
      </div>

      <!-- Test Cases List -->
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto;">
        ${report.results
          .map(
            (r, i) => `
          <div class="card" style="padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 1.1rem; line-height: 1;">${r.passed ? '✅' : '❌'}</span>
            <div style="flex: 1;">
              <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); line-height: 1.3;">
                ${i + 1}. ${r.name}
              </div>
              ${r.details ? `<div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${r.details}</div>` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    footer.innerHTML = `
      <div style="display: flex; gap: 10px; width: 100%;">
        <button class="btn btn-secondary" id="btn-re-run-tests" style="flex: 1;">
          🔄 Run Again
        </button>
        <button class="btn btn-primary" data-close-modal="modal-unit-tests" style="flex: 1;">
          Close
        </button>
      </div>
    `;

    const rerunBtn = footer.querySelector('#btn-re-run-tests');
    if (rerunBtn) {
      rerunBtn.addEventListener('click', () => {
        this.showTestResultsModal();
      });
    }

    NavigationManager.openModal('modal-unit-tests');
  }
}
