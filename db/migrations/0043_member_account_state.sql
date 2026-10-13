ALTER TABLE `members`
  ADD COLUMN `account_status` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin
    NOT NULL DEFAULT 'active',
  ADD COLUMN `account_role` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin
    NOT NULL DEFAULT 'member',
  ADD COLUMN `suspension_reason` VARCHAR(500) NULL,
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD CONSTRAINT `chk_member_account_status` CHECK
    (`account_status` IN ('active', 'deactivated', 'suspended', 'deleted')),
  ADD CONSTRAINT `chk_member_account_role` CHECK
    (`account_role` IN ('member', 'moderator', 'admin'));
