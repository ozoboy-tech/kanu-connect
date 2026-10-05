CREATE TABLE `member_sessions` (
  `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`token_hash`),
  KEY `idx_member_sessions_member` (`member_id`),
  CONSTRAINT `fk_member_session_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
