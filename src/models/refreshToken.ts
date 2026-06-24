import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "refresh_tokens" })
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // FK to User.id (UUID). Kept as a plain indexed column — no ORM relation needed.
  @Index()
  @Column({ type: "char", length: 36 })
  userId!: string;

  // SHA-256 hex of the raw token (64 chars).
  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  tokenHash!: string;

  // Rotation lineage (a UUID): a reused (already-rotated) token revokes its whole family.
  @Index()
  @Column({ type: "char", length: 36 })
  family!: string;

  @Column({ type: "datetime" })
  expiresAt!: Date;

  @Column({ type: "datetime", nullable: true })
  revokedAt!: Date | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  replacedByHash!: string | null;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}
