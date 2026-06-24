import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type VerificationType = "email_verify";

@Entity({ name: "verification_tokens" })
export class VerificationToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // FK to User.id (UUID).
  @Index()
  @Column({ type: "char", length: 36 })
  userId!: string;

  // SHA-256 hex of the raw token (64 chars).
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  tokenHash!: string;

  @Column({ type: "varchar", length: 32 })
  type!: VerificationType;

  @Column({ type: "datetime" })
  expiresAt!: Date;

  @Column({ type: "datetime", nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}
