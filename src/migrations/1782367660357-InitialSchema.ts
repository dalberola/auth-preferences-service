import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782367660357 implements MigrationInterface {
    name = 'InitialSchema1782367660357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`email\` varchar(320) NOT NULL, \`passwordHash\` varchar(255) NOT NULL, \`emailVerified\` tinyint NOT NULL DEFAULT 0, \`preferences\` json NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`refresh_tokens\` (\`id\` varchar(36) NOT NULL, \`userId\` char(36) NOT NULL, \`tokenHash\` varchar(255) NOT NULL, \`family\` char(36) NOT NULL, \`expiresAt\` datetime NOT NULL, \`revokedAt\` datetime NULL, \`replacedByHash\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_610102b60fea1455310ccd299d\` (\`userId\`), UNIQUE INDEX \`IDX_c25bc63d248ca90e8dcc1d92d0\` (\`tokenHash\`), INDEX \`IDX_968936751ab847471635be8dc0\` (\`family\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`verification_tokens\` (\`id\` varchar(36) NOT NULL, \`userId\` char(36) NOT NULL, \`tokenHash\` varchar(255) NOT NULL, \`type\` varchar(32) NOT NULL, \`expiresAt\` datetime NOT NULL, \`consumedAt\` datetime NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_8eb720a87e85b20fdfc69c3826\` (\`userId\`), UNIQUE INDEX \`IDX_95dc856379282e84bc4de3c790\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_95dc856379282e84bc4de3c790\` ON \`verification_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_8eb720a87e85b20fdfc69c3826\` ON \`verification_tokens\``);
        await queryRunner.query(`DROP TABLE \`verification_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_968936751ab847471635be8dc0\` ON \`refresh_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_c25bc63d248ca90e8dcc1d92d0\` ON \`refresh_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_610102b60fea1455310ccd299d\` ON \`refresh_tokens\``);
        await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
