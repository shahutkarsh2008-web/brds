# BRDS CBT Exam System — Exam Day Operations & Invigilator Runbook

This runbook outlines operational procedures, failure-mode checklists, and emergency actions for **BRDS Test Centers** during live Computer-Based Test (CBT) exams.

---

## 📋 1. Pre-Exam Preparation Checklist (T-30 Minutes)

1. **Server & Database Preflight Check**:
   Run the preflight health script:
   ```bash
   npm run check:launch -- https://brds-cbt.onrender.com
   ```
   - Ensure `[PASS]` output for Health Check, Database Connection, and WebSockets.

2. **Test Center Network Readiness**:
   - Verify Wi-Fi / LAN router stability.
   - Ensure local student machines can resolve `https://brds-cbt.onrender.com`.

3. **Invigilator Dashboard Login**:
   - Invigilator / Teacher logs into `https://brds-cbt.onrender.com/teacher` using registered credentials.
   - Verify that all registered students appear on the live roster grid.

---

## ⚡ 2. Live Exam Monitoring Procedures

- **Real-Time Live Hub**:
  - The teacher dashboard streams real-time answered counts, section timers, and student online status over WSS WebSockets.
- **Activity Flags**:
  - Automatically flags student tab switching, window blurring, or exiting full-screen mode.
  - Flagged students display a visual badge on the invigilator grid.

---

## 🚨 3. Emergency Failure-Mode Protocols

### Scenario A: A Student Machine Freezes or Crashes
1. **No Data Loss**: The student's answer palette and remaining section time are continuously saved server-side after every click.
2. **Action**: Reboot student browser or switch student to a backup PC.
3. **Resumption**: Student logs in again -> exam engine automatically restores exact saved palette state and original exam countdown timer.

### Scenario B: Temporary Internet Disconnect at Center
1. **Offline Queue**: The student exam frontend stores unanswered & answered queue items locally in browser storage.
2. **Auto-Retry**: Once connectivity is restored, the exam client automatically syncs pending answers back to the server.

### Scenario C: Disruptive Student / Cheating Flag
1. **Reversible Freeze**: Invigilator clicks **Freeze** on the student card. This pauses student exam timers server-side and disables question inputs.
2. **Resume / Unfreeze**: Once cleared, invigilator clicks **Resume** to restore the student's exam timer without lost time.
3. **Permanent Lock**: For confirmed policy violations, invigilator clicks **Lock & Submit** to lock the attempt permanently.

---

## 💾 4. Post-Exam Operations & Backup

1. **Automated Submission**: When the exam timer expires, the server sweep worker automatically submits all active student attempts.
2. **Score Generation**: Batch rankings, percentile ranks, section accuracy breakdowns, and CSV scorecards generate immediately.
3. **One-Click Backup**: Administrator navigates to Admin Settings -> **Export JSON Backup** to download the complete attempt archive for record keeping.
