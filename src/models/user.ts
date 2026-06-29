import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type Theme = "light" | "dark" | "system";

export interface Preferences {
  theme: Theme;
  locale: string;
  schemaVersion: number;
  // Free-form bag for app-specific settings; validated at the API boundary.
  settings: Record<string, unknown>;
  // Logical clock for the settings blob: epoch-ms of the edit a client last
  // wrote. Used for optimistic concurrency — a PUT carrying an older value than
  // the stored one is rejected (409) so a stale device cannot clobber a newer
  // device's config. 0 means "never written by a sync-aware client" (legacy /
  // default record), which any timestamped write supersedes.
  updatedAt: number;
}

export const defaultPreferences = (): Preferences => ({
  theme: "system",
  locale: "en",
  schemaVersion: 1,
  settings: {},
  updatedAt: 0,
});

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Stored lowercased by the service; unique so a second registration is a no-op.
  @Index({ unique: true })
  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "boolean", default: false })
  emailVerified!: boolean;

  // Per-account login lockout (managed by modules/auth/service.ts). Consecutive
  // failed logins increment the counter; crossing the threshold sets `lockedUntil`.
  @Column({ type: "int", default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: "datetime", nullable: true })
  lockedUntil!: Date | null;

  // GDPR consent record: which Terms/Privacy version the user accepted at
  // registration, and when. Nullable for accounts created before consent capture.
  @Column({ type: "varchar", length: 32, nullable: true })
  consentVersion!: string | null;

  @Column({ type: "datetime", nullable: true })
  consentAt!: Date | null;

  // Last time the account showed activity: set at registration and refreshed on
  // every login AND token refresh (active users refresh silently far more often
  // than they re-login). The inactivity reaper purges accounts whose
  // `lastActiveAt` is older than the configured window.
  @Column({ type: "datetime", nullable: true })
  lastActiveAt!: Date | null;

  // When an "about to be deleted for inactivity" warning email was last sent.
  // Set by the reaper to avoid re-warning every tick; cleared whenever the user
  // becomes active again, so a later inactivity cycle warns afresh.
  @Column({ type: "datetime", nullable: true })
  inactivityWarnedAt!: Date | null;

  // JSON column (MariaDB has no embedded-document type). Partial updates are done
  // read-merge-save in the service rather than via column-level writes.
  @Column({ type: "json" })
  preferences!: Preferences;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;
}
