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
}

export const defaultPreferences = (): Preferences => ({
  theme: "system",
  locale: "en",
  schemaVersion: 1,
  settings: {},
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

  // JSON column (MariaDB has no embedded-document type). Partial updates are done
  // read-merge-save in the service rather than via column-level writes.
  @Column({ type: "json" })
  preferences!: Preferences;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;
}
