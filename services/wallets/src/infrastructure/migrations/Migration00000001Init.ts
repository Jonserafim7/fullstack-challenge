import { Migration } from "@mikro-orm/migrations";

export class Migration00000001Init extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "wallet" ("player_id" varchar(255) not null, "balance" bigint not null default 0, constraint "wallet_pkey" primary key ("player_id"));',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "wallet";');
  }
}
