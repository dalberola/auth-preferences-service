import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserConsent1782455171485 implements MigrationInterface {
    name = 'AddUserConsent1782455171485'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`consentVersion\` varchar(32) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`consentAt\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`consentAt\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`consentVersion\``);
    }

}
