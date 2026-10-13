CREATE TABLE `account_admin_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `target_id` BIGINT UNSIGNED NOT NULL,
  `actor_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_account_audit_target` (`target_id`, `id`),
  CONSTRAINT `fk_account_audit_target` FOREIGN KEY (`target_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_account_audit_actor` FOREIGN KEY (`actor_id`)
    REFERENCES `members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_account_audit_action` CHECK
    (`action` IN ('suspend', 'restore', 'role')),
  CONSTRAINT `chk_account_audit_reason` CHECK
    (CHAR_LENGTH(TRIM(`reason`)) > 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
