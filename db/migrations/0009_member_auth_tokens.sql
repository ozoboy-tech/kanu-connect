CREATE TABLE `member_auth_tokens` (
  `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `purpose` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`token_hash`),
  KEY `idx_member_auth_tokens_member` (`member_id`, `purpose`),
  CONSTRAINT `chk_member_auth_token_purpose`
    CHECK (`purpose` IN ('verify', 'reset')),
  CONSTRAINT `fk_member_auth_token_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
