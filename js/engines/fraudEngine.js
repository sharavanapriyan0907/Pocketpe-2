/* ==========================================================================
   POCKETPE - FRAUD DETECTION & COMMUNITY SPAM ENGINE
   "Truecaller for UPI" — Spam scoring, time decay, trust weighting, signals & appeals
   ========================================================================== */

import { stateManager } from '../state.js';

export const REPORT_REASONS = [
  'Fake collect request',
  'Repeated money requests',
  'Impersonation',
  'Prize or lottery scam',
  'Other',
];

export const RISK_LEVELS = {
  LOW: 'LOW',
  CAUTION: 'CAUTION',
  HIGH: 'HIGH',
};

export class FraudEngine {
  /**
   * Half-life for time decay in days (reports lose 50% weight after 30 days)
   */
  static HALF_LIFE_DAYS = 30;

  /**
   * Minimum raw unique reports required before community spam score triggers public warning
   */
  static MIN_REPORT_THRESHOLD = 5;

  /**
   * Maximum reports allowed per user in a 1-hour window
   */
  static RATE_LIMIT_MAX_PER_HOUR = 5;

  /**
   * Calculate time decay factor (0 to 1) based on age in milliseconds
   */
  static calculateTimeDecay(createdAtMs, nowMs = Date.now()) {
    const ageDays = Math.max(0, (nowMs - createdAtMs) / (1000 * 60 * 60 * 24));
    // Exponential decay: e^(-ln(2) * age / halfLife) = 0.5^(age / halfLife)
    return Math.pow(0.5, ageDays / this.HALF_LIFE_DAYS);
  }

  /**
   * Calculate spam score & risk profile for a given UPI ID
   * @param {string} upiId
   * @param {Object} [customState] - Optional state override for unit tests
   */
  static evaluateUpiRisk(upiId, customState = null) {
    if (!upiId) {
      return {
        upiId: '',
        level: RISK_LEVELS.LOW,
        score: 0,
        rawReportCount: 0,
        uniqueReporters: 0,
        interactedCount: 0,
        topReason: '',
        reasonSummary: 'Safe UPI ID',
        extraSignals: [],
        underReview: false,
        appeal: null,
      };
    }

    const normalizedUpi = upiId.trim().toLowerCase();
    const fraudData = customState?.fraudDetection || stateManager.getFraudData();
    const allReports = (fraudData.reports || []).filter(
      (r) => r.reportedUpiId && r.reportedUpiId.toLowerCase() === normalizedUpi
    );

    // 1. Group unique reporters (keep latest report per reporter)
    const reporterMap = new Map();
    const reasonCounts = {};

    allReports.forEach((rep) => {
      const repKey = rep.reporterId;
      const decay = this.calculateTimeDecay(new Date(rep.createdAt).getTime());
      const trust = rep.reporterTrust !== undefined ? rep.reporterTrust : 1.0;
      const effectiveWeight = trust * decay;

      if (!reporterMap.has(repKey) || reporterMap.get(repKey).effectiveWeight < effectiveWeight) {
        reporterMap.set(repKey, {
          ...rep,
          effectiveWeight,
        });
      }

      reasonCounts[rep.reason] = (reasonCounts[rep.reason] || 0) + 1;
    });

    const uniqueReporters = reporterMap.size;
    let weightedReportSum = 0;
    reporterMap.forEach((rep) => {
      weightedReportSum += rep.effectiveWeight;
    });

    // 2. Interacted users count
    const interactionsList = fraudData.interactions?.[normalizedUpi] || [];
    // Ensure unique reporters are also counted as interacted
    const uniqueInteractedSet = new Set([...interactionsList, ...reporterMap.keys()]);
    const interactedCount = Math.max(uniqueInteractedSet.size, uniqueReporters, 1);

    // 3. Spam Score Formula: unique_reporters / unique_users_who_interacted
    // Weighted by time decay and reporter trust
    const rawScore = weightedReportSum / interactedCount;
    const spamScore = Math.min(1.0, Math.round(rawScore * 100) / 100);

    // 4. Identify top reported reason
    let topReason = '';
    let maxReasonCount = 0;
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      if (count > maxReasonCount) {
        maxReasonCount = count;
        topReason = reason;
      }
    });

    // 5. Extra Signals (account age, velocity, name mismatch)
    const registryInfo = fraudData.upiRegistry?.[normalizedUpi] || {};
    const extraSignals = [];

    if (registryInfo.registeredDaysAgo !== undefined && registryInfo.registeredDaysAgo < 14) {
      extraSignals.push({
        id: 'new_account',
        label: `Newly created UPI ID (${registryInfo.registeredDaysAgo} days old)`,
        severity: 'medium',
      });
    }

    if (registryInfo.collectVelocity1h && registryInfo.collectVelocity1h > 10) {
      extraSignals.push({
        id: 'high_velocity',
        label: `Abnormal collect request velocity (${registryInfo.collectVelocity1h} in past hour)`,
        severity: 'high',
      });
    }

    if (registryInfo.nameMismatch) {
      extraSignals.push({
        id: 'name_mismatch',
        label: `Name mismatch: KYC registered as "${registryInfo.registeredName || 'Individual'}"`,
        severity: 'high',
      });
    }

    // 6. Check Active Appeal
    const appeals = fraudData.appeals || [];
    const activeAppeal = appeals.find(
      (a) => a.upiId.toLowerCase() === normalizedUpi && a.status === 'under_review'
    );
    const underReview = !!activeAppeal;

    // 7. Threshold and Risk Level Classification
    let level = RISK_LEVELS.LOW;
    let reasonSummary = 'Community verified / Low activity';

    // Must meet threshold of unique reports or severe compounding signals
    const meetsThreshold = uniqueReporters >= this.MIN_REPORT_THRESHOLD;

    if (meetsThreshold) {
      if (spamScore >= 0.4 || extraSignals.some((s) => s.severity === 'high')) {
        level = RISK_LEVELS.HIGH;
        reasonSummary = `${uniqueReporters} users reported ${topReason.toLowerCase() || 'suspicious activity'}`;
      } else if (spamScore >= 0.15 || extraSignals.length > 0) {
        level = RISK_LEVELS.CAUTION;
        reasonSummary = `${uniqueReporters} users reported potential issues`;
      } else {
        level = RISK_LEVELS.LOW;
        reasonSummary = 'Low report ratio among active interactions';
      }
    } else if (uniqueReporters > 0) {
      // Below threshold (e.g. 1-4 reports) -> Extra signals can flag caution
      if (extraSignals.length >= 2) {
        level = RISK_LEVELS.CAUTION;
        reasonSummary = `${uniqueReporters} reports + ${extraSignals.length} risk signals detected`;
      } else {
        level = RISK_LEVELS.LOW;
        reasonSummary = `${uniqueReporters} unverified report(s) (under ${this.MIN_REPORT_THRESHOLD} report threshold)`;
      }
    } else if (extraSignals.some((s) => s.severity === 'high')) {
      level = RISK_LEVELS.CAUTION;
      reasonSummary = 'Caution: High velocity or suspicious identity flags';
    }

    return {
      upiId: normalizedUpi,
      level,
      score: spamScore,
      rawReportCount: allReports.length,
      uniqueReporters,
      interactedCount,
      topReason: topReason || 'None',
      reasonSummary,
      extraSignals,
      underReview,
      appeal: activeAppeal || null,
      meetsThreshold,
    };
  }

  /**
   * Validate and record a new community report
   */
  static submitReport({ reportedUpiId, reason, details = '', reporterId = null, deviceId = null }) {
    if (!reportedUpiId || !reportedUpiId.trim()) {
      return { success: false, error: 'Please specify a valid UPI ID.' };
    }
    if (!reason || !REPORT_REASONS.includes(reason)) {
      return { success: false, error: 'Please select a valid report reason.' };
    }

    const state = stateManager.getState();
    const userId = reporterId || state.user.id;
    const devId = deviceId || 'dev_current_user';
    const normalizedUpi = reportedUpiId.trim().toLowerCase();

    const fraudData = stateManager.getFraudData();

    // 1. Check for Duplicate Report (One report per user per UPI ID)
    const existing = (fraudData.reports || []).find(
      (r) => r.reporterId === userId && r.reportedUpiId.toLowerCase() === normalizedUpi
    );
    if (existing) {
      return {
        success: false,
        error: `You have already reported this UPI ID (${new Date(existing.createdAt).toLocaleDateString()}). Duplicate reports are ignored to protect against spam.`,
      };
    }

    // 2. Abuse Protection: Rate-limit reports per user (Max 5 per hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const userRecentReports = (fraudData.reports || []).filter(
      (r) => (r.reporterId === userId || r.deviceId === devId) && new Date(r.createdAt).getTime() > oneHourAgo
    );

    if (userRecentReports.length >= this.RATE_LIMIT_MAX_PER_HOUR) {
      return {
        success: false,
        error: `Rate limit reached: Maximum ${this.RATE_LIMIT_MAX_PER_HOUR} reports per hour to prevent abuse. Please try again later.`,
      };
    }

    // 3. Multi-account on same device check (Sybil detection)
    const sameDeviceDifferentUsers = (fraudData.reports || []).filter(
      (r) => r.deviceId === devId && r.reporterId !== userId && r.reportedUpiId.toLowerCase() === normalizedUpi
    );
    // If same device already reported under another user, give lower trust weight
    const trustWeight = sameDeviceDifferentUsers.length > 0 ? 0.2 : 1.0;

    // 4. Save report in StateManager
    const report = stateManager.addFraudReport({
      reporterId: userId,
      reporterTrust: trustWeight,
      reportedUpiId: normalizedUpi,
      reason,
      details,
      deviceId: devId,
    });

    const updatedRisk = this.evaluateUpiRisk(normalizedUpi);

    return {
      success: true,
      report,
      updatedRisk,
      message: `Report submitted for ${normalizedUpi}. Thank you for keeping the community safe!`,
    };
  }

  /**
   * Submit an appeal for a flagged UPI ID
   */
  static submitAppeal(upiId, appealReason) {
    if (!upiId || !upiId.trim()) {
      return { success: false, error: 'UPI ID is required.' };
    }
    if (!appealReason || appealReason.trim().length < 5) {
      return { success: false, error: 'Please provide a clear reason for your appeal (at least 5 characters).' };
    }

    const appeal = stateManager.submitAppeal(upiId.trim().toLowerCase(), appealReason.trim());
    return {
      success: true,
      appeal,
      message: 'Your appeal has been submitted and is under review. The risk status is marked as "Under Review".',
    };
  }
}
