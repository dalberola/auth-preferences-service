import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInactivityTracking1782460000000 implements MigrationInterface {
    name = 'AddInactivityTracking1782460000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`lastActiveAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`inactivityWarnedAt\` datetime NULL`);
        // Backfill existing accounts to "now" so each gets a full inactivity
        // window from this migration. Using `createdAt` would purge any account
        // already older than the window on the first reaper tick — and without a
        // warning, since it would skip straight past the warn window.
        await queryRunner.query(`UPDATE \`users\` SET \`lastActiveAt\` = UTC_TIMESTAMP() WHERE \`lastActiveAt\` IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`inactivityWarnedAt\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`lastActiveAt\``);
    }

}
