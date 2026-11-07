# SchoolBridge Database Backup & Disaster Recovery Guide

## 1. Overview
SchoolBridge incorporates an automated multi-tenant database backup and restoration utility designed to protect institutional records, academic achievements, billing ledgers, and audit trails.

The backup system produces timestamped BSON/EJSON snapshots alongside a symlinked or cloned `latest/` directory containing a comprehensive metadata manifest.

---

## 2. Protected Collections (18 Core Collections)
The automated backup scripts encompass all 18 system collections across academic, administrative, and financial domains:

1. `schools` - Tenant configurations, branding assets, contact details, grading scales, and assessment configurations.
2. `users` - Administrator, teacher, accountant, and staff accounts, credentials, and permissions.
3. `students` - Student demographics, admission profiles, class enrollments, and academic streams (factions).
4. `classlevels` - Educational levels (e.g., JSS 1, SSS 2, Primary).
5. `classgroups` - Class arms/sections, class teachers, room assignments, and Senior Secondary stream factions.
6. `subjects` - Curricular subjects, codes, streams (Science/Arts/Commercial), and class associations.
7. `subjectregistrations` - Student-subject enrollment mappings per academic session.
8. `studentresults` - CA scores, exam scores, affective & psychomotor ratings, remarks, completion states, and approvals.
9. `periods` - Active school terms and calendar intervals.
10. `sessions` - Academic calendar years.
11. `terms` - Individual academic terms (1st, 2nd, 3rd Term).
12. `academicsessions` - Institutional academic session definitions and billing term links.
13. `attendances` - Daily and term-level student attendance records.
14. `billtemplates` - Termly fee structures, tuition brackets, and optional bill line items.
15. `feeinvoices` - Student fee bills, itemized charges, notes, discounts, balance carryovers, and payment statuses.
16. `feepayments` - Transaction logs, payment receipts, verification tokens, payment methods, and reversal statuses.
17. `paymentvouchers` - Expenditure vouchers, expense categories, beneficiaries, and 4-tier approval sign-offs.
18. `auditlogs` - Comprehensive audit trail tracking sensitive actions (student updates, grade modifications, financial revisions).

---

## 3. Running an Automated Backup

To trigger a full snapshot of all collections:

```bash
# From project root:
npm --prefix backend run backup

# Or within the backend directory:
npm run backup
```

### Backup Artifacts
- **Location:** `backend/backups/snapshot-<ISO-TIMESTAMP>/`
- **Latest Pointer:** `backend/backups/latest/`
- **Format:** Pure JSON with MongoDB Extended JSON / BSON fidelity (`$oid`, `$date`).
- **Manifest:** `manifest.json` detailing snapshot date, total record count, and per-collection counts.

---

## 4. Restoring From a Backup

SchoolBridge provides two restore modes: **Safe Upsert Mode** (default) and **Clean Wipe Mode** (`--clean`).

### Mode 1: Safe Upsert (Recommended for Rollbacks & Point-in-Time Recovery)
Merges records by primary key (`_id`), updating existing records without deleting records created after the snapshot.

```bash
# Restore from the latest snapshot:
npm --prefix backend run restore latest

# Restore from a specific snapshot timestamp:
npm --prefix backend run restore snapshot-2026-11-07T19-27-57-488Z
```

### Mode 2: Clean Wipe Restore (Disaster Recovery & Clean Environments)
Drops or truncates the targeted collections before inserting snapshot data.

```bash
npm --prefix backend run restore latest --clean
```

---

## 5. Automated Scheduling & Production Best Practices

### Scheduled Cron Execution (Linux / Production Host)
To automate backups nightly at 02:00 AM UTC:
```cron
0 2 * * * cd /opt/schoolbridge && npm --prefix backend run backup >> /var/log/schoolbridge-backup.log 2>&1
```

### Off-site Storage & S3 Synchronization
For enterprise deployments, sync local backup folders to encrypted cloud object storage:
```bash
aws s3 sync backend/backups/ s3://schoolbridge-encrypted-backups/$(date +%Y-%m)/ --sse aws:kms
```

### Encryption & Tenant Isolation
1. **At-Rest Encryption:** Ensure underlying MongoDB clusters utilize encrypted storage volumes (LUKS / EBS KMS) and TLS/SSL in transit.
2. **Access Control:** Restrict database direct connection credentials to isolated VPCs or authorized service IPs.
3. **Audit Verification:** All restore operations must be recorded in the `auditlogs` collection or operational change management logs.
