CREATE TABLE `member_oauth_accounts` (
  `provider` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider_account_id` VARCHAR(255)
    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,

  PRIMARY KEY (`provider`, `provider_account_id`),
  KEY `idx_member_oauth_member` (`member_id`),
  CONSTRAINT `fk_member_oauth_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
